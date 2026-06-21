import { Test, TestingModule } from '@nestjs/testing';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import type { AuthUser } from '../auth/auth.types';

describe('SessionsController', () => {
  let controller: SessionsController;
  let service: {
    startSession: jest.Mock;
    listActiveSessions: jest.Mock;
    listMySessions: jest.Mock;
    getSession: jest.Mock;
    getSessionToken: jest.Mock;
    endSession: jest.Mock;
    markDisconnected: jest.Mock;
  };

  const user: AuthUser = {
    sub: 'sub-1',
    username: 'tech.dev',
    email: 'tech@test.com',
    roles: ['TechnicalStaff'],
  };

  beforeEach(async () => {
    service = {
      startSession: jest.fn(),
      listActiveSessions: jest.fn(),
      listMySessions: jest.fn(),
      getSession: jest.fn(),
      getSessionToken: jest.fn(),
      endSession: jest.fn(),
      markDisconnected: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionsController],
      providers: [{ provide: SessionsService, useValue: service }],
    }).compile();

    controller = module.get(SessionsController);
  });

  it('startSession forwards ALB auth headers to the service', () => {
    const dto = { hostId: 'host-1', crId: 'cr-1', osUser: 'root' };
    const response = { websocketUrl: 'wss://gw', sessionToken: 'tok', sessionId: 's1' };
    service.startSession.mockReturnValue(response);
    const req = {
      headers: {
        'x-amzn-oidc-accesstoken': 'access-token',
        'x-amzn-oidc-data': 'claims-token',
        'x-amzn-oidc-identity': 'user-sub',
      },
    } as never;

    expect(controller.startSession(dto, user, req)).toBe(response);
    expect(service.startSession).toHaveBeenCalledWith(dto, user, {
      accessToken: 'access-token',
      oidcData: 'claims-token',
      oidcIdentity: 'user-sub',
    });
  });

  it('listActive delegates with optional hostId filter', () => {
    const sessions = [{ id: 's1' }];
    service.listActiveSessions.mockReturnValue(sessions);

    expect(controller.listActive('host-1')).toBe(sessions);
    expect(service.listActiveSessions).toHaveBeenCalledWith('host-1');
  });

  it('listMine delegates with caller username', () => {
    const sessions = [{ id: 's1' }];
    service.listMySessions.mockReturnValue(sessions);

    expect(controller.listMine(user)).toBe(sessions);
    expect(service.listMySessions).toHaveBeenCalledWith('tech.dev');
  });

  it('getOne delegates to service', () => {
    const session = { id: 's1' };
    service.getSession.mockReturnValue(session);
    expect(controller.getOne('s1')).toBe(session);
  });

  it('endSession delegates to service with id and username', () => {
    const session = { id: 's1', status: 'ended' };
    service.endSession.mockReturnValue(session);

    expect(controller.endSession('s1', user)).toBe(session);
    expect(service.endSession).toHaveBeenCalledWith('s1', 'tech.dev');
  });

  it('disconnect delegates to service', () => {
    service.markDisconnected.mockReturnValue(undefined);
    expect(controller.disconnect('s1')).toBeUndefined();
    expect(service.markDisconnected).toHaveBeenCalledWith('s1');
  });
});
