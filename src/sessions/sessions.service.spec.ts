import { ServiceUnavailableException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';

jest.mock('@aws-sdk/client-cognito-identity-provider');

import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { SessionsService } from './sessions.service';
import { Session } from './session.entity';
import { ChangeRequest, ChangeRequestStatus } from '../change-request/change-request.entity';
import { ImplementerGroup } from '../implementer-group/implementer-group.entity';
import { ImplementerGroupMember } from '../implementer-group/implementer-group-member.entity';
import { VirtualMachine } from '../inventory/vm.entity';
import type { AuthUser } from '../auth/auth.types';
import type { GatewayUserAuth } from './gateway-auth';

const userGatewayAuth: GatewayUserAuth = {
  accessToken: 'user-cognito-token',
  oidcData: 'claims-token',
  oidcIdentity: 'user-sub',
};

const makeTokenResponse = (token = 'access-token-123', expiresIn = 3600) => ({
  AuthenticationResult: { AccessToken: token, ExpiresIn: expiresIn },
});

const makeFetchResponse = (body: unknown, status = 200, ok = true) => ({
  status,
  ok,
  json: jest.fn().mockResolvedValue(body),
  text: jest.fn().mockResolvedValue(String(body)),
});

const mockUser: AuthUser = {
  sub: 'user-sub',
  username: 'tech.dev',
  email: 'tech@test.com',
  roles: ['Admin'],
};

const mockVm = { id: 'host-1', hostname: 'server01', ipAddress: '10.0.0.1', sshPort: 22 };
const mockSession = { id: 'session-uuid', update: jest.fn().mockResolvedValue({}) };
const mockCr = {
  id: 'cr-1',
  status: ChangeRequestStatus.Approved,
  vmIds: ['host-1'],
  allowedRoles: [],
};

describe('SessionsService', () => {
  let service: SessionsService;
  let mockSend: jest.Mock;

  const mockSessionModel = {
    create: jest.fn().mockResolvedValue(mockSession),
    findAll: jest.fn().mockResolvedValue([]),
    findByPk: jest.fn().mockResolvedValue(mockSession),
  };

  const mockCrModel = {
    findByPk: jest.fn().mockResolvedValue(mockCr),
  };

  const mockGroupModel = {
    findAll: jest.fn().mockResolvedValue([]),
  };

  const mockMemberModel = {
    findAll: jest.fn().mockResolvedValue([]),
  };

  const mockVmModel = {
    findByPk: jest.fn().mockResolvedValue(mockVm),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSession.update.mockResolvedValue({});

    mockSend = jest.fn();
    (CognitoIdentityProviderClient as jest.Mock).mockImplementation(() => ({
      send: mockSend,
    }));
    (InitiateAuthCommand as unknown as jest.Mock).mockImplementation((input: unknown) => ({ input }));

    global.fetch = jest.fn();

    process.env.SSH_GATEWAY_COGNITO_CLIENT_ID = 'test-client-id';
    process.env.SSH_GATEWAY_COGNITO_CLIENT_SECRET = '';
    process.env.SSH_GATEWAY_URL = 'https://gateway.test';
    process.env.SSH_GATEWAY_EMAIL = 'bot@test.com';
    process.env.SSH_GATEWAY_PASSWORD = 'Password1!';
    process.env.DEV_JWT_SECRET = 'test-secret';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: getModelToken(Session), useValue: mockSessionModel },
        { provide: getModelToken(ChangeRequest), useValue: mockCrModel },
        { provide: getModelToken(ImplementerGroup), useValue: mockGroupModel },
        { provide: getModelToken(ImplementerGroupMember), useValue: mockMemberModel },
        { provide: getModelToken(VirtualMachine), useValue: mockVmModel },
      ],
    }).compile();

    service = module.get(SessionsService);
  });

  afterEach(() => {
    delete process.env.SSH_GATEWAY_COGNITO_CLIENT_ID;
    delete process.env.SSH_GATEWAY_COGNITO_CLIENT_SECRET;
    delete process.env.SSH_GATEWAY_URL;
    delete process.env.SSH_GATEWAY_EMAIL;
    delete process.env.SSH_GATEWAY_PASSWORD;
  });

  describe('startSession', () => {
    const dto = { hostId: 'host-1', crId: 'cr-1', connectionType: 'ssh' };
    const sessionPayload = { websocketUrl: 'wss://gw/ws', sessionToken: 'tok' };

    it('authenticates with Cognito, calls gateway, persists session and returns data', async () => {
      mockSend.mockResolvedValue(makeTokenResponse());
      (global.fetch as jest.Mock).mockResolvedValue(makeFetchResponse(sessionPayload));

      const result = await service.startSession(dto, mockUser);
      expect(result.websocketUrl).toBe(sessionPayload.websocketUrl);
      expect(result.sessionToken).toBe(sessionPayload.sessionToken);
      expect(result.sessionId).toBeDefined();
      expect(result.scopedJwt).toBeDefined();
      expect(mockSessionModel.create).toHaveBeenCalled();
    });

    it('forwards ALB OIDC headers without calling Cognito InitiateAuth', async () => {
      (global.fetch as jest.Mock).mockResolvedValue(makeFetchResponse(sessionPayload));

      await service.startSession(dto, mockUser, userGatewayAuth);

      expect(mockSend).not.toHaveBeenCalled();
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[1].headers.Authorization).toBeUndefined();
      expect(fetchCall[1].headers['x-amzn-oidc-accesstoken']).toBe('user-cognito-token');
      expect(fetchCall[1].headers['x-amzn-oidc-data']).toBe('claims-token');
      expect(fetchCall[1].headers['x-amzn-oidc-identity']).toBe('user-sub');
    });

    it('throws when the gateway rejects user credentials with 401', async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        makeFetchResponse('token expired', 401, false),
      );

      await expect(
        service.startSession(dto, mockUser, userGatewayAuth),
      ).rejects.toThrow('Cognito session expired');
    });

    it('does not forward osUser to the gateway (gateway resolves OS user from CR)', async () => {
      mockSend.mockResolvedValue(makeTokenResponse());
      (global.fetch as jest.Mock).mockResolvedValue(makeFetchResponse(sessionPayload));

      await service.startSession({ ...dto, osUser: 'osadm1' }, mockUser);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body).not.toHaveProperty('osUser');
    });

    it('forwards the gateway inventory host ID instead of the webapp VM UUID', async () => {
      mockSend.mockResolvedValue(makeTokenResponse());
      (global.fetch as jest.Mock).mockResolvedValue(makeFetchResponse(sessionPayload));

      await service.startSession(dto, mockUser);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.hostId).toBe(mockVm.hostname);
    });

    it('omits osUser from the gateway request body when not provided', async () => {
      mockSend.mockResolvedValue(makeTokenResponse());
      (global.fetch as jest.Mock).mockResolvedValue(makeFetchResponse(sessionPayload));

      await service.startSession(dto, mockUser);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body).not.toHaveProperty('osUser');
    });

    it('re-authenticates and retries when the gateway returns 401', async () => {
      mockSend.mockResolvedValue(makeTokenResponse('refreshed-token'));
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(makeFetchResponse('Unauthorized', 401, false))
        .mockResolvedValueOnce(makeFetchResponse(sessionPayload));

      const result = await service.startSession(dto, mockUser);
      expect(result.websocketUrl).toBe(sessionPayload.websocketUrl);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('throws ServiceUnavailableException when gateway returns non-ok status', async () => {
      mockSend.mockResolvedValue(makeTokenResponse());
      (global.fetch as jest.Mock).mockResolvedValue(makeFetchResponse('Server Error', 500, false));

      await expect(service.startSession(dto, mockUser)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('throws ForbiddenException when CR does not exist for non-admin', async () => {
      mockCrModel.findByPk.mockResolvedValueOnce(null);
      const nonAdmin: AuthUser = { ...mockUser, roles: ['TechnicalStaff'] };

      await expect(service.startSession(dto, nonAdmin)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when hostId is not in CR vmIds', async () => {
      mockCrModel.findByPk.mockResolvedValueOnce({ ...mockCr, vmIds: ['other-host'] });
      const nonAdmin: AuthUser = { ...mockUser, roles: ['TechnicalStaff'] };

      await expect(service.startSession(dto, nonAdmin)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when user has no implementer group access without CR', async () => {
      const nonAdmin: AuthUser = { ...mockUser, roles: ['TechnicalStaff'] };
      mockMemberModel.findAll.mockResolvedValueOnce([]);

      await expect(
        service.startSession({ hostId: 'host-1', crId: '' }, nonAdmin),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getRejoinCandidates', () => {
    it('queries the gateway with the gateway inventory host ID', async () => {
      const gatewayResponse = { sessions: [] };
      (global.fetch as jest.Mock).mockResolvedValue(makeFetchResponse(gatewayResponse));

      await expect(
        service.getRejoinCandidates('host-1', 'cr-1', mockUser, userGatewayAuth),
      ).resolves.toEqual(gatewayResponse);

      const [url] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe(
        `https://gateway.test/sessions/rejoin-candidates?hostId=${encodeURIComponent(
          mockVm.hostname,
        )}&crId=cr-1`,
      );
    });
  });

  describe('listActiveSessions', () => {
    it('returns active sessions optionally filtered by hostId', async () => {
      const sessions = [{ id: 's1', status: 'active' }];
      mockSessionModel.findAll.mockResolvedValue(sessions);

      await expect(service.listActiveSessions('host-1')).resolves.toBe(sessions);
      expect(mockSessionModel.findAll).toHaveBeenCalledWith({
        where: { status: 'active', hostId: 'host-1' },
        order: [['startedAt', 'DESC']],
      });
    });
  });

  describe('listMySessions', () => {
    it('returns sessions created by the given username', async () => {
      const sessions = [{ id: 's1', createdBy: 'tech.dev' }];
      mockSessionModel.findAll.mockResolvedValue(sessions);

      await expect(service.listMySessions('tech.dev')).resolves.toBe(sessions);
      expect(mockSessionModel.findAll).toHaveBeenCalledWith({
        where: { createdBy: 'tech.dev' },
        order: [['startedAt', 'DESC']],
        limit: 50,
      });
    });
  });

  describe('getSession', () => {
    it('throws NotFoundException when session does not exist', async () => {
      mockSessionModel.findByPk.mockResolvedValueOnce(null);
      await expect(service.getSession('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSessionToken', () => {
    it('returns stored credentials and issues a fresh scoped JWT', async () => {
      const session = {
        id: 'session-uuid',
        hostId: 'host-1',
        hostname: 'server01',
        crId: 'cr-1',
        websocketUrl: 'wss://gw/ws',
        sessionToken: 'tok',
        update: jest.fn().mockResolvedValue({}),
      };
      mockSessionModel.findByPk.mockResolvedValueOnce(session);

      const result = await service.getSessionToken('session-uuid', mockUser);
      expect(result.websocketUrl).toBe('wss://gw/ws');
      expect(result.sessionToken).toBe('tok');
      expect(result.scopedJwt).toBeDefined();
      expect(session.update).toHaveBeenCalledWith(
        expect.objectContaining({ lastActivityAt: expect.any(Date) }),
      );
    });

    it('throws NotFoundException when credentials are missing', async () => {
      mockSessionModel.findByPk.mockResolvedValueOnce({
        id: 'session-uuid',
        websocketUrl: null,
        sessionToken: null,
      });

      await expect(service.getSessionToken('session-uuid', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('endSession', () => {
    it('marks session as ended with endedAt timestamp', async () => {
      const session = {
        id: 'session-uuid',
        update: jest.fn().mockResolvedValue({ id: 'session-uuid', status: 'ended' }),
      };
      mockSessionModel.findByPk.mockResolvedValueOnce(session);

      await service.endSession('session-uuid', 'tech.dev');
      expect(session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ended',
          endedAt: expect.any(Date),
        }),
      );
    });
  });

  describe('markDisconnected', () => {
    it('updates active session status to disconnected', async () => {
      const session = {
        id: 'session-uuid',
        status: 'active',
        update: jest.fn().mockResolvedValue({}),
      };
      mockSessionModel.findByPk.mockResolvedValueOnce(session);

      await service.markDisconnected('session-uuid');
      expect(session.update).toHaveBeenCalledWith({ status: 'disconnected' });
    });

    it('does nothing when session is not active', async () => {
      const session = {
        id: 'session-uuid',
        status: 'ended',
        update: jest.fn(),
      };
      mockSessionModel.findByPk.mockResolvedValueOnce(session);

      await service.markDisconnected('session-uuid');
      expect(session.update).not.toHaveBeenCalled();
    });
  });

  describe('ensureAuthenticated', () => {
    const dto = { hostId: 'host-1', crId: 'cr-1' };

    it('throws ServiceUnavailableException when cognitoClientId is not configured', async () => {
      delete process.env.SSH_GATEWAY_COGNITO_CLIENT_ID;
      delete process.env.COGNITO_CLIENT_ID;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SessionsService,
          { provide: getModelToken(Session), useValue: mockSessionModel },
          { provide: getModelToken(ChangeRequest), useValue: mockCrModel },
          { provide: getModelToken(ImplementerGroup), useValue: mockGroupModel },
          { provide: getModelToken(ImplementerGroupMember), useValue: mockMemberModel },
          { provide: getModelToken(VirtualMachine), useValue: mockVmModel },
        ],
      }).compile();
      const svc = module.get(SessionsService);

      await expect(svc.startSession(dto, mockUser)).rejects.toThrow(ServiceUnavailableException);
    });

    it('requires only the gateway URL when a user access token is supplied', async () => {
      delete process.env.SSH_GATEWAY_EMAIL;
      delete process.env.SSH_GATEWAY_PASSWORD;
      delete process.env.SSH_GATEWAY_COGNITO_CLIENT_ID;
      delete process.env.COGNITO_CLIENT_ID;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SessionsService,
          { provide: getModelToken(Session), useValue: mockSessionModel },
          { provide: getModelToken(ChangeRequest), useValue: mockCrModel },
          { provide: getModelToken(ImplementerGroup), useValue: mockGroupModel },
          { provide: getModelToken(ImplementerGroupMember), useValue: mockMemberModel },
          { provide: getModelToken(VirtualMachine), useValue: mockVmModel },
        ],
      }).compile();
      const svc = module.get(SessionsService);

      (global.fetch as jest.Mock).mockResolvedValue(
        makeFetchResponse({ websocketUrl: 'wss://gw', sessionToken: 't' }),
      );

      await expect(
        svc.startSession(dto, mockUser, userGatewayAuth),
      ).resolves.toEqual(
        expect.objectContaining({ websocketUrl: 'wss://gw', sessionToken: 't' }),
      );
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('throws ServiceUnavailableException when Cognito InitiateAuth fails', async () => {
      mockSend.mockRejectedValue(new Error('NotAuthorizedException'));
      await expect(service.startSession(dto, mockUser)).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws ServiceUnavailableException when Cognito returns no token', async () => {
      mockSend.mockResolvedValue({ AuthenticationResult: {} });
      await expect(service.startSession(dto, mockUser)).rejects.toThrow(ServiceUnavailableException);
    });

    it('reuses the cached token when it has not expired', async () => {
      const sessionPayload = { websocketUrl: 'wss://gw', sessionToken: 't' };
      mockSend.mockResolvedValue(makeTokenResponse('cached-token', 3600));
      (global.fetch as jest.Mock).mockResolvedValue(makeFetchResponse(sessionPayload));

      await service.startSession(dto, mockUser);
      await service.startSession(dto, mockUser);

      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('computes SECRET_HASH when a client secret is configured', async () => {
      process.env.SSH_GATEWAY_COGNITO_CLIENT_SECRET = 'my-secret';
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SessionsService,
          { provide: getModelToken(Session), useValue: mockSessionModel },
          { provide: getModelToken(ChangeRequest), useValue: mockCrModel },
          { provide: getModelToken(ImplementerGroup), useValue: mockGroupModel },
          { provide: getModelToken(ImplementerGroupMember), useValue: mockMemberModel },
          { provide: getModelToken(VirtualMachine), useValue: mockVmModel },
        ],
      }).compile();
      const svc = module.get(SessionsService);

      mockSend.mockResolvedValue(makeTokenResponse());
      (global.fetch as jest.Mock).mockResolvedValue(
        makeFetchResponse({ websocketUrl: 'wss://gw', sessionToken: 't' }),
      );

      await svc.startSession(dto, mockUser);

      const [cmd] = mockSend.mock.calls[0];
      expect(cmd.input.AuthParameters).toHaveProperty('SECRET_HASH');
      expect(typeof cmd.input.AuthParameters.SECRET_HASH).toBe('string');
    });
  });
});
