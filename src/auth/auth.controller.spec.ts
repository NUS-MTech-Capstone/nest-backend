import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { TokenService } from './token.service';
import { PolicyService } from '../identity/policy.service';
import { DEV_USERS } from './auth.constants';
import type { AuthUser } from './auth.types';

describe('AuthController', () => {
  let controller: AuthController;
  let tokenService: { mode: string; issueDevToken: jest.Mock };
  let policyService: { getPermissionsForRoles: jest.Mock };

  beforeEach(async () => {
    tokenService = {
      mode: 'dev',
      issueDevToken: jest.fn(),
    };
    policyService = {
      getPermissionsForRoles: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: TokenService, useValue: tokenService },
        { provide: PolicyService, useValue: policyService },
      ],
    }).compile();

    controller = module.get(AuthController);
  });

  describe('getConfig', () => {
    it('returns dev users when auth mode is dev', () => {
      expect(controller.getConfig()).toEqual({
        mode: 'dev',
        devUsers: DEV_USERS.map(({ username, name, roles }) => ({
          username,
          name,
          roles,
        })),
      });
    });

    it('returns empty dev users when auth mode is cognito', () => {
      tokenService.mode = 'cognito';

      expect(controller.getConfig()).toEqual({
        mode: 'cognito',
        devUsers: [],
      });
    });
  });

  describe('devLogin', () => {
    it('issues a dev token for the requested username', () => {
      const token = { accessToken: 'token', user: { username: 'alice' } };
      tokenService.issueDevToken.mockReturnValue(token);

      expect(controller.devLogin({ username: 'alice' })).toBe(token);
      expect(tokenService.issueDevToken).toHaveBeenCalledWith('alice');
    });
  });

  describe('me', () => {
    it('returns user with sorted permissions', async () => {
      const user: AuthUser = {
        sub: '1',
        username: 'alice',
        name: 'Alice',
        roles: ['Employee'],
      };
      policyService.getPermissionsForRoles.mockResolvedValue(
        new Set(['change.view', 'access.view']),
      );

      await expect(controller.me(user)).resolves.toEqual({
        ...user,
        permissions: ['access.view', 'change.view'],
      });
      expect(policyService.getPermissionsForRoles).toHaveBeenCalledWith(
        user.roles,
      );
    });
  });
});
