import { createHmac } from 'crypto';
import { sign } from 'jsonwebtoken';
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { AuthUser } from '../auth/auth.types';
import { ChangeRequest, ChangeRequestStatus } from '../change-request/change-request.entity';
import { ImplementerGroup } from '../implementer-group/implementer-group.entity';
import { ImplementerGroupMember } from '../implementer-group/implementer-group-member.entity';
import { VirtualMachine } from '../inventory/vm.entity';
import { Session } from './session.entity';
import { StartSessionDto } from './dto/start-session.dto';
import {
  buildGatewayAuthHeaders,
  type GatewayUserAuth,
} from './gateway-auth';
import {
  resolveGatewayCognitoClientId,
  resolveGatewayUrl,
} from './gateway-config';

export interface GatewaySessionResponse {
  /** Gateway-assigned session ID */
  sessionId: string;
  sessionToken: string;
  websocketUrl: string;
  /** ISO-8601 timestamp when the session / token expires */
  expiresAt: string;
}

/** Matches the gateway spec's SessionCandidate schema. */
export interface GatewayRejoinCandidate {
  sessionId: string;
  hostId: string;
  crId: string;
  connectionType: string;
  status: string;
  createdAt: string;
  lastHeartbeatAt: string;
  leaseExpiresAt: string;
}

export interface SessionStartResponse extends GatewaySessionResponse {
  /** Short-lived scoped JWT issued by this platform */
  scopedJwt: string;
}

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);
  private readonly gatewayUrl: string;
  private readonly gatewayEmail: string;
  private readonly gatewayPassword: string;
  private readonly cognitoRegion: string;
  private readonly cognitoClientId: string;
  private readonly cognitoClientSecret: string;
  private readonly jwtSecret: string;

  private cachedToken: string | null = null;
  private tokenExpiry = 0;

  constructor(
    @InjectModel(Session) private sessionModel: typeof Session,
    @InjectModel(ChangeRequest) private changeRequestModel: typeof ChangeRequest,
    @InjectModel(ImplementerGroup) private implementerGroupModel: typeof ImplementerGroup,
    @InjectModel(ImplementerGroupMember) private memberModel: typeof ImplementerGroupMember,
    @InjectModel(VirtualMachine) private vmModel: typeof VirtualMachine,
  ) {
    this.gatewayUrl = resolveGatewayUrl();
    this.gatewayEmail = process.env.SSH_GATEWAY_EMAIL ?? '';
    this.gatewayPassword = process.env.SSH_GATEWAY_PASSWORD ?? '';
    this.cognitoRegion =
      process.env.SSH_GATEWAY_COGNITO_REGION ??
      process.env.AWS_REGION ??
      'ap-southeast-1';
    this.cognitoClientId = resolveGatewayCognitoClientId();
    this.cognitoClientSecret =
      process.env.SSH_GATEWAY_COGNITO_CLIENT_SECRET ??
      process.env.COGNITO_CLIENT_SECRET ??
      '';
    this.jwtSecret = process.env.DEV_JWT_SECRET ?? 'dev-secret-change-me';
  }

  // ── Start Session ─────────────────────────────────────────────────────────

  async startSession(
    dto: StartSessionDto,
    user: AuthUser,
    userAuth?: GatewayUserAuth,
  ): Promise<SessionStartResponse> {
    this.ensureGatewayConfigured(!!userAuth);

    // 1. Validate Access Policy (UC: Validate Access Policy)
    const vm = await this.validateAccessPolicy(dto, user);
    const gatewayHostId = this.gatewayHostIdFor(dto.hostId, vm);

    // 2. Authenticate with SSH gateway and start connection (UC: Route to Access Proxy)
    let response = await this.callGatewayWithAuth(userAuth, (headers) =>
      this.callSessionStart(dto, gatewayHostId, headers),
    );

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(`Session start failed: HTTP ${response.status} — ${body}`);
      throw new ServiceUnavailableException(`SSH gateway returned ${response.status}`);
    }

    const gateway = await (response.json() as Promise<GatewaySessionResponse>);

    // 3. Track Session State (UC: Track Session State)
    const crNumber = dto.crId ? `CR-${dto.crId.slice(0, 8).toUpperCase()}` : undefined;
    const record = await this.sessionModel.create({
      hostId: dto.hostId,
      hostname: vm?.hostname ?? dto.hostId,
      ipAddress: vm?.ipAddress,
      sshPort: vm?.sshPort,
      crId: dto.crId || undefined,
      crNumber,
      // osUser is stored for audit/display; the gateway determines the actual
      // OS user from the CR or host configuration (per gateway API spec).
      osUser: dto.osUser ?? '',
      createdBy: user.username,
      status: 'active' as const,
      gatewaySessionId: gateway.sessionId,
      sessionToken: gateway.sessionToken,
      websocketUrl: gateway.websocketUrl,
      startedAt: new Date(),
    } as any);

    // 4. Issue Short-Lived JWT (UC: Issue Short-Lived JWT)
    const scopedJwt = sign(
      {
        sessionId: record.id,
        hostId: dto.hostId,
        hostname: vm?.hostname,
        crId: dto.crId ?? null,
        sub: user.sub,
        username: user.username,
        type: 'session-access',
      },
      this.jwtSecret,
      { expiresIn: '15m' },
    );

    await record.update({ scopedJwt });

    this.logger.log(`Session started: ${record.id} by ${user.username} on ${vm?.hostname}`);
    // Return the gateway fields but override sessionId with our internal record ID
    // so the frontend uses the DDM session ID for all subsequent API calls.
    return {
      sessionId: record.id,
      sessionToken: gateway.sessionToken,
      websocketUrl: gateway.websocketUrl,
      expiresAt: gateway.expiresAt,
      scopedJwt,
    };
  }

  // ── Validate Access Policy ────────────────────────────────────────────────

  /** UC: Validate Access Policy — verifies the caller has the right to access
   *  the requested server via an approved CR or their implementer group membership. */
  private async validateAccessPolicy(
    dto: StartSessionDto,
    user: AuthUser,
  ): Promise<VirtualMachine | null> {
    const isAdmin = user.roles.includes('Admin');

    // Resolve the target VM for display info
    const vm = await this.vmModel.findByPk(dto.hostId);

    // Admins bypass policy checks
    if (isAdmin) return vm;

    if (dto.crId) {
      // CR-based access path
      const cr = await this.changeRequestModel.findByPk(dto.crId);
      if (!cr || cr.status !== ChangeRequestStatus.Approved) {
        throw new ForbiddenException('Change request is not approved or does not exist');
      }
      // Verify host is in CR scope
      if (!cr.vmIds.includes(dto.hostId)) {
        throw new ForbiddenException('Target server is not covered by this change request');
      }
      // Verify user role is allowed
      if (cr.allowedRoles.length > 0) {
        const hasRole = cr.allowedRoles.some((role) => user.roles.includes(role));
        if (!hasRole) {
          throw new ForbiddenException('Your role is not permitted by this change request');
        }
      }
      return vm;
    }

    // Group-based access path (no CR)
    const memberships = await this.memberModel.findAll({
      where: { username: user.username },
    });
    if (!memberships.length) {
      throw new ForbiddenException('You are not a member of any implementer group');
    }

    const groupIds = memberships.map((m) => m.implementerGroupId);
    const groups = await this.implementerGroupModel.findAll({
      where: { id: groupIds },
    });

    const hasAccess = groups.some((g) => (g.vmIds ?? []).includes(dto.hostId));
    if (!hasAccess) {
      throw new ForbiddenException(
        'None of your implementer groups grant access to this server',
      );
    }

    return vm;
  }

  // ── Session Management ────────────────────────────────────────────────────

  /** All active sessions (optionally filtered by hostId). Used for the Sessions
   *  tab where collaborators can see and join running sessions. */
  async listActiveSessions(hostId?: string): Promise<Session[]> {
    const where: Record<string, unknown> = { status: 'active' };
    if (hostId) where['hostId'] = hostId;
    return this.sessionModel.findAll({
      where,
      order: [['startedAt', 'DESC']],
    });
  }

  /** Sessions started by the current user (all statuses). Used for reconnect. */
  async listMySessions(username: string): Promise<Session[]> {
    return this.sessionModel.findAll({
      where: { createdBy: username },
      order: [['startedAt', 'DESC']],
      limit: 50,
    });
  }

  async getSession(id: string): Promise<Session> {
    const session = await this.sessionModel.findByPk(id);
    if (!session) throw new NotFoundException(`Session ${id} not found`);
    return session;
  }

  /** Return the stored gateway credentials for reconnecting to a session.
   *  Issues a fresh scoped JWT even for reconnect requests. */
  async getSessionToken(
    id: string,
    user: AuthUser,
  ): Promise<{ websocketUrl: string; sessionToken: string; scopedJwt: string }> {
    const session = await this.getSession(id);

    if (!session.websocketUrl || !session.sessionToken) {
      throw new NotFoundException('Session credentials are no longer available');
    }

    // Re-issue a short-lived JWT for this reconnect
    const scopedJwt = sign(
      {
        sessionId: session.id,
        hostId: session.hostId,
        hostname: session.hostname,
        crId: session.crId ?? null,
        sub: user.sub,
        username: user.username,
        type: 'session-reconnect',
      },
      this.jwtSecret,
      { expiresIn: '15m' },
    );

    // Touch lastActivityAt
    await session.update({ lastActivityAt: new Date() });

    return {
      websocketUrl: session.websocketUrl,
      sessionToken: session.sessionToken,
      scopedJwt,
    };
  }

  async endSession(id: string, username: string): Promise<Session> {
    const session = await this.getSession(id);
    await session.update({
      status: 'ended' as const,
      endedAt: new Date(),
    });
    this.logger.log(`Session ${id} ended by ${username}`);
    return session;
  }

  async markDisconnected(id: string): Promise<void> {
    const session = await this.sessionModel.findByPk(id);
    if (session && session.status === 'active') {
      await session.update({ status: 'disconnected' as const });
    }
  }

  // ── Rejoin / Observe ─────────────────────────────────────────────────────

  /** UC: Select Existing Session — query the gateway for sessions that the
   *  caller can rejoin on a given host/CR pair. */
  async getRejoinCandidates(
    hostId: string,
    crId: string | undefined,
    user: AuthUser,
    userAuth?: GatewayUserAuth,
  ): Promise<{ sessions: GatewayRejoinCandidate[] }> {
    await this.validateAccessPolicy({ hostId, crId, connectionType: 'ssh' }, user);
    const vm = await this.vmModel.findByPk(hostId);
    const gatewayHostId = this.gatewayHostIdFor(hostId, vm);

    const params = new URLSearchParams({ hostId: gatewayHostId });
    if (crId) params.set('crId', crId);

    const response = await this.callGatewayWithAuth(userAuth, (headers) =>
      fetch(`${this.gatewayUrl}/sessions/rejoin-candidates?${params.toString()}`, {
        headers,
      }),
    );

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(`Rejoin-candidates failed: HTTP ${response.status} — ${body}`);
      throw new ServiceUnavailableException(
        `SSH gateway returned ${response.status} for rejoin-candidates`,
      );
    }

    // Gateway spec: RejoinCandidatesResponse = { sessions: SessionCandidate[] }
    return response.json() as Promise<{ sessions: GatewayRejoinCandidate[] }>;
  }

  /** UC: Reconnect Session — tell the gateway to issue a new WebSocket ticket
   *  for an existing session that the user previously owned. */
  async rejoinSession(
    id: string,
    user: AuthUser,
    userAuth?: GatewayUserAuth,
  ): Promise<{ websocketUrl: string; sessionToken: string; scopedJwt: string }> {
    const session = await this.getSession(id);

    if (!session.gatewaySessionId) {
      throw new ServiceUnavailableException(
        'Session has no gateway reference — it may predate rejoin support',
      );
    }

    const response = await this.callGatewayWithAuth(userAuth, (headers) =>
      this.callGatewayPost(`/sessions/${session.gatewaySessionId}/rejoin`, headers),
    );
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(`Rejoin failed: HTTP ${response.status} — ${body}`);
      throw new ServiceUnavailableException(
        `SSH gateway returned ${response.status} for rejoin`,
      );
    }

    const gateway = await (response.json() as Promise<GatewaySessionResponse>);

    const scopedJwt = sign(
      {
        sessionId: session.id,
        hostId: session.hostId,
        hostname: session.hostname,
        crId: session.crId ?? null,
        sub: user.sub,
        username: user.username,
        type: 'session-rejoin',
      },
      this.jwtSecret,
      { expiresIn: '15m' },
    );

    await session.update({ lastActivityAt: new Date() });
    this.logger.log(`Session ${id} rejoined by ${user.username}`);

    return { websocketUrl: gateway.websocketUrl, sessionToken: gateway.sessionToken, scopedJwt };
  }

  /** UC: Observe Session — get a read-only WebSocket ticket for an active
   *  session the caller has permission to watch. */
  async observeSession(
    id: string,
    user: AuthUser,
    userAuth?: GatewayUserAuth,
  ): Promise<{ websocketUrl: string; sessionToken: string }> {
    const session = await this.getSession(id);

    if (!session.gatewaySessionId) {
      throw new ServiceUnavailableException(
        'Session has no gateway reference — it may predate observe support',
      );
    }

    const response = await this.callGatewayWithAuth(userAuth, (headers) =>
      this.callGatewayPost(`/sessions/${session.gatewaySessionId}/observe`, headers),
    );
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(`Observe failed: HTTP ${response.status} — ${body}`);
      throw new ServiceUnavailableException(
        `SSH gateway returned ${response.status} for observe`,
      );
    }

    const gateway = await (response.json() as Promise<GatewaySessionResponse>);
    this.logger.log(`Session ${id} observed by ${user.username}`);
    return { websocketUrl: gateway.websocketUrl, sessionToken: gateway.sessionToken };
  }

  // ── SSH Gateway helpers ───────────────────────────────────────────────────

  private ensureGatewayConfigured(useUserAccessToken = false): void {
    const missing: string[] = [];
    if (!this.gatewayUrl) {
      missing.push('SSH_GATEWAY_URL (or SSH_GATEWAY_SERVICE_HOST/PORT)');
    }
    if (!useUserAccessToken) {
      if (!this.gatewayEmail) missing.push('SSH_GATEWAY_EMAIL');
      if (!this.gatewayPassword) missing.push('SSH_GATEWAY_PASSWORD');
      if (!this.cognitoClientId) {
        missing.push('SSH_GATEWAY_COGNITO_CLIENT_ID or COGNITO_CLIENT_ID');
      }
    }
    if (missing.length > 0) {
      throw new ServiceUnavailableException(
        `SSH gateway is not configured (${missing.join(', ')})`,
      );
    }
  }

  private async resolveGatewayAuthToken(): Promise<string> {
    await this.ensureAuthenticated();
    if (!this.cachedToken) {
      throw new ServiceUnavailableException('SSH gateway authentication failed');
    }
    return this.cachedToken;
  }

  private async callGatewayWithAuth(
    userAuth: GatewayUserAuth | undefined,
    call: (headers: Record<string, string>) => Promise<Response>,
  ): Promise<Response> {
    this.ensureGatewayConfigured(!!userAuth);

    if (userAuth && !userAuth.oidcData) {
      throw new ServiceUnavailableException(
        'Missing ALB OIDC claims header — reload the page and sign in again',
      );
    }

    let bearerToken = userAuth ? undefined : await this.resolveGatewayAuthToken();
    let headers = buildGatewayAuthHeaders(bearerToken, userAuth);
    this.logger.debug(
      `Gateway auth: ${userAuth ? 'alb-oidc' : 'service-account'} headers=${Object.keys(headers).join(',')}`,
    );
    let response = await call(headers);

    if (response.status === 401) {
      const body = await response.text().catch(() => '');
      if (userAuth) {
        this.logger.error(
          `Gateway rejected user credentials: HTTP 401 — ${body || '(empty body)'}`,
        );
        throw new ServiceUnavailableException(
          this.gatewayAuthFailureMessage(body),
        );
      }
      this.logger.warn('Gateway service-account token expired, re-authenticating...');
      this.cachedToken = null;
      bearerToken = await this.resolveGatewayAuthToken();
      headers = buildGatewayAuthHeaders(bearerToken);
      response = await call(headers);
    }

    return response;
  }

  private gatewayAuthFailureMessage(gatewayBody: string): string {
    const detail = gatewayBody.trim();
    if (/expired|expir/i.test(detail)) {
      return 'Cognito session expired — reload the page and try again';
    }
    if (detail) {
      return `SSH gateway rejected credentials: ${detail}`;
    }
    return 'SSH gateway rejected credentials — reload the page and sign in again';
  }

  private callSessionStart(
    dto: StartSessionDto,
    gatewayHostId: string,
    headers: Record<string, string>,
  ): Promise<Response> {
    // Gateway API spec: start body is { hostId, crId, connectionType } only.
    // osUser is NOT forwarded — the gateway resolves the OS user from the CR
    // or host configuration. We store osUser locally for audit purposes.
    const body: Record<string, string> = {
      hostId: gatewayHostId,
      connectionType: dto.connectionType ?? 'ssh',
    };
    if (dto.crId) {
      body['crId'] = dto.crId;
    }
    return fetch(`${this.gatewayUrl}/sessions/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    });
  }

  private callGatewayPost(
    path: string,
    headers: Record<string, string>,
    body?: Record<string, unknown>,
  ): Promise<Response> {
    return fetch(`${this.gatewayUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  private gatewayHostIdFor(webappHostId: string, vm: VirtualMachine | null): string {
    return vm?.hostname || webappHostId;
  }

  private computeSecretHash(username: string): string {
    return createHmac('sha256', this.cognitoClientSecret)
      .update(username + this.cognitoClientId)
      .digest('base64');
  }

  private async ensureAuthenticated(): Promise<void> {
    if (this.cachedToken && Date.now() < this.tokenExpiry) return;

    if (!this.cognitoClientId) {
      throw new ServiceUnavailableException(
        'SSH gateway Cognito client is not configured (set SSH_GATEWAY_COGNITO_CLIENT_ID or COGNITO_CLIENT_ID)',
      );
    }

    this.logger.log(
      `Authenticating with Cognito (region=${this.cognitoRegion}, client=${this.cognitoClientId})`,
    );

    const cognito = new CognitoIdentityProviderClient({ region: this.cognitoRegion });

    let result;
    try {
      const authParams: Record<string, string> = {
        USERNAME: this.gatewayEmail,
        PASSWORD: this.gatewayPassword,
      };
      if (this.cognitoClientSecret) {
        authParams['SECRET_HASH'] = this.computeSecretHash(this.gatewayEmail);
      }
      const cmd = new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: this.cognitoClientId,
        AuthParameters: authParams,
      });
      result = await cognito.send(cmd);
    } catch (err) {
      this.logger.error(`Cognito InitiateAuth failed: ${err}`);
      throw new ServiceUnavailableException(
        `Cognito authentication failed: ${(err as Error).message}`,
      );
    }

    const auth = result.AuthenticationResult;
    const token = auth?.AccessToken ?? auth?.IdToken;
    if (!token) throw new ServiceUnavailableException('Cognito returned no access token');

    this.cachedToken = token;
    const ttl = ((auth?.ExpiresIn ?? 3600) - 60) * 1_000;
    this.tokenExpiry = Date.now() + ttl;
    this.logger.log('SSH gateway Cognito authentication successful');
  }
}
