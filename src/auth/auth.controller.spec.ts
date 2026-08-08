import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
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

    it('returns empty dev users when auth mode is alb', () => {
      tokenService.mode = 'alb';

      expect(controller.getConfig()).toEqual({
        mode: 'alb',
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

  describe('login', () => {
    it('redirects to APP_LOGIN_REDIRECT in alb mode', () => {
      tokenService.mode = 'alb';
      process.env.APP_LOGIN_REDIRECT = '/access';
      const redirect = jest.fn();
      const res = {
        redirect,
      } as unknown as Response;

      controller.login(res);

      expect(redirect).toHaveBeenCalledWith('/access');
    });

    it('rejects login when auth mode is dev', () => {
      expect(() =>
        controller.login({ redirect: jest.fn() } as unknown as Response),
      ).toThrow(BadRequestException);
    });
  });

  describe('logout', () => {
    it('expires every ALB auth cookie shard and redirects to Cognito logout', () => {
      tokenService.mode = 'alb';
      process.env.ALB_AUTH_COOKIE_NAME = 'AWSELBAuthSessionCookie';
      process.env.COGNITO_CLIENT_ID = 'client-id';
      process.env.COGNITO_DOMAIN =
        'example.auth.ap-southeast-1.amazoncognito.com';
      process.env.APP_LOGOUT_URI = 'http://localhost:4200/login';

      const clearCookie = jest.fn();
      const set = jest.fn();
      const redirect = jest.fn();
      const res = {
        clearCookie,
        set,
        redirect,
      } as unknown as Response;

      controller.logout(res);

      const cookieOptions = {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'none',
      };
      expect(clearCookie).toHaveBeenCalledTimes(5);
      for (const name of [
        'AWSELBAuthSessionCookie',
        'AWSELBAuthSessionCookie-0',
        'AWSELBAuthSessionCookie-1',
        'AWSELBAuthSessionCookie-2',
        'AWSELBAuthSessionCookie-3',
      ]) {
        expect(clearCookie).toHaveBeenCalledWith(name, cookieOptions);
      }
      expect(set).toHaveBeenCalledWith({
        'Cache-Control': 'no-store, max-age=0',
        Expires: '0',
        Pragma: 'no-cache',
      });
      expect(redirect).toHaveBeenCalledWith(
        'https://example.auth.ap-southeast-1.amazoncognito.com/logout?client_id=client-id&logout_uri=http%3A%2F%2Flocalhost%3A4200%2Flogin',
      );
    });

    it('rejects logout when auth mode is dev', () => {
      expect(() =>
        controller.logout({
          clearCookie: jest.fn(),
          redirect: jest.fn(),
        } as unknown as Response),
      ).toThrow(BadRequestException);
    });
  });
});
