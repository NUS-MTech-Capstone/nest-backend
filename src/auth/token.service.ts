import { createVerify } from 'crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import * as jwt from 'jsonwebtoken';
import { DEV_USERS } from './auth.constants';
import { AuthUser } from './auth.types';

export type AuthMode = 'dev' | 'alb';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  readonly mode: AuthMode = process.env.AUTH_MODE === 'alb' ? 'alb' : 'dev';

  private readonly devSecret =
    process.env.DEV_JWT_SECRET || 'dev-secret-change-me';

  private cognitoJwtVerifier?: ReturnType<typeof CognitoJwtVerifier.create>;
  private readonly albPublicKeyCache = new Map<string, string>();

  albVerifier = {
    verify: (token: string) => this.verifyAlbOidcDataToken(token),
  };

  cognitoVerifier = {
    verify: (token: string) => this.getCognitoVerifier().verify(token),
  };

  async verify(token: string): Promise<AuthUser> {
    if (this.mode === 'alb') {
      throw new UnauthorizedException(
        'Bearer tokens are not used when AUTH_MODE=alb',
      );
    }

    try {
      const payload = jwt.verify(token, this.devSecret) as jwt.JwtPayload;
      return {
        sub: payload.sub || '',
        username: (payload['username'] as string) || payload.sub || '',
        email: payload['email'] as string | undefined,
        name: payload['name'] as string | undefined,
        roles: (payload['cognito:groups'] as string[]) || [],
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  async verifyAlbHeaders(
    oidcData: string,
    accessToken: string,
  ): Promise<AuthUser> {
    const claims = (await this.albVerifier.verify(oidcData)) as jwt.JwtPayload;
    const accessPayload = (await this.cognitoVerifier.verify(
      accessToken,
    )) as Record<string, unknown>;

    const claimsSub = claims.sub as string | undefined;
    const accessSub = accessPayload.sub as string | undefined;
    if (!claimsSub || !accessSub || claimsSub !== accessSub) {
      throw new UnauthorizedException('ALB and Cognito subject mismatch');
    }

    // Cognito puts the username under 'cognito:username' in OIDC tokens.
    const username =
      (claims['cognito:username'] as string) ||
      (claims['preferred_username'] as string) ||
      (claims.username as string) ||
      claimsSub;

    return {
      sub: claimsSub,
      username,
      email: claims.email as string | undefined,
      name: claims.name as string | undefined,
      roles: (accessPayload['cognito:groups'] as string[]) || [],
    };
  }

  issueDevToken(username: string): { accessToken: string; user: AuthUser } {
    if (this.mode !== 'dev') {
      throw new BadRequestException(
        'Dev login is disabled when AUTH_MODE=alb',
      );
    }

    const devUser = DEV_USERS.find((user) => user.username === username);
    if (!devUser) {
      throw new UnauthorizedException(`Unknown dev user: ${username}`);
    }

    const user: AuthUser = {
      sub: `dev-${devUser.username}`,
      username: devUser.username,
      email: devUser.email,
      name: devUser.name,
      roles: devUser.roles,
    };

    const accessToken = jwt.sign(
      {
        sub: user.sub,
        username: user.username,
        email: user.email,
        name: user.name,
        'cognito:groups': user.roles,
      },
      this.devSecret,
      { expiresIn: '8h' },
    );

    return { accessToken, user };
  }

  private getCognitoVerifier() {
    if (!this.cognitoJwtVerifier) {
      const userPoolId = process.env.COGNITO_USER_POOL_ID;
      const clientId = process.env.COGNITO_CLIENT_ID;
      if (!userPoolId || !clientId) {
        throw new Error(
          'COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID must be set when AUTH_MODE=alb',
        );
      }
      this.cognitoJwtVerifier = CognitoJwtVerifier.create({
        userPoolId,
        tokenUse: 'access',
        clientId,
      });
    }
    return this.cognitoJwtVerifier;
  }

  private async verifyAlbOidcDataToken(token: string): Promise<jwt.JwtPayload> {
    const region = process.env.AWS_REGION;
    const albArn = process.env.ALB_ARN;
    if (!region || !albArn) {
      throw new UnauthorizedException(
        'AWS_REGION and ALB_ARN must be configured for AUTH_MODE=alb',
      );
    }

    // Strip ALL whitespace — some proxies fold long headers with \r\n + space,
    // inserting internal newlines that .trim() does not remove.
    const sanitized = token.replace(/\s+/g, '');

    // ── Manual JWT structure validation ──────────────────────────────────────
    // jwt.decode() returns null for any format error without telling us why.
    // Splitting manually gives us precise diagnostics at each failure point.
    const parts = sanitized.split('.');
    if (parts.length !== 3) {
      this.logger.error(
        `ALB OIDC token has ${parts.length} dot-separated parts (expected 3) — ` +
          `original length=${token.length}, sanitized length=${sanitized.length}`,
      );
      throw new UnauthorizedException('Invalid ALB OIDC token');
    }

    let header: Record<string, unknown>;
    let payload: jwt.JwtPayload;

    try {
      header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    } catch (e) {
      this.logger.error(
        `ALB OIDC header base64url decode failed — ` +
          `part[0] length=${parts[0].length}, starts with="${parts[0].slice(0, 10)}": ${e}`,
      );
      throw new UnauthorizedException('Invalid ALB OIDC token');
    }

    try {
      payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf8'),
      ) as jwt.JwtPayload;
    } catch (e) {
      this.logger.error(
        `ALB OIDC payload base64url decode failed — ` +
          `part[1] length=${parts[1].length}: ${e}`,
      );
      throw new UnauthorizedException('Invalid ALB OIDC token');
    }
    // ─────────────────────────────────────────────────────────────────────────

    // The 'signer' claim contains the ALB ARN. Verify it matches the configured
    // ARN so tokens issued by a different ALB are rejected.
    const tokenSigner = payload.signer as string | undefined;
    if (tokenSigner && tokenSigner !== albArn) {
      this.logger.error(
        `ALB signer mismatch — token signer="${tokenSigner}", expected="${albArn}"`,
      );
      throw new UnauthorizedException('ALB signer mismatch');
    }
    if (!tokenSigner) {
      this.logger.warn('ALB OIDC token has no signer claim — skipping ARN check');
    }

    const kid = header.kid as string | undefined;
    if (!kid) {
      throw new UnauthorizedException('Missing ALB OIDC key id');
    }

    const publicKey = await this.getAlbPublicKey(region, kid);

    // ── ES256 signature verification via Node.js crypto ───────────────────
    // jwt.verify() re-parses the token internally using the jws library's own
    // base64url decoder, which differs from Buffer('base64url') and throws
    // "invalid token" for tokens that our manual parsing handles correctly.
    // Using crypto directly bypasses that parsing layer entirely.
    const signedData = `${parts[0]}.${parts[1]}`;
    const signatureBuffer = Buffer.from(parts[2], 'base64url');

    let signatureValid: boolean;
    try {
      const verifier = createVerify('SHA256');
      verifier.update(signedData);
      signatureValid = verifier.verify(publicKey, signatureBuffer);
    } catch (e) {
      this.logger.error(`ALB OIDC crypto verify error: ${e}`);
      throw new UnauthorizedException('ALB OIDC signature verification failed');
    }

    if (!signatureValid) {
      throw new UnauthorizedException('ALB OIDC signature invalid');
    }

    // ── Standard JWT claim validation ─────────────────────────────────────
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp !== undefined && payload.exp < now) {
      throw new UnauthorizedException('ALB OIDC token expired');
    }
    if (payload.nbf !== undefined && payload.nbf > now + 5) {
      throw new UnauthorizedException('ALB OIDC token not yet valid');
    }

    return payload;
  }

  private async getAlbPublicKey(region: string, kid: string): Promise<string> {
    const cacheKey = `${region}:${kid}`;
    const cached = this.albPublicKeyCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // The ALB public key endpoint returns a PEM-encoded EC public key as
    // plain text — NOT a JSON Web Key. Using response.json() here would
    // throw a JSON parse error.
    const response = await fetch(
      `https://public-keys.auth.elb.${region}.amazonaws.com/${kid}`,
    );
    if (!response.ok) {
      throw new UnauthorizedException(
        `Unable to fetch ALB public key (kid=${kid}, status=${response.status})`,
      );
    }

    const pem = await response.text();
    this.albPublicKeyCache.set(cacheKey, pem);
    return pem;
  }
}
