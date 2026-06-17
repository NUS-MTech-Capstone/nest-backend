import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TokenService } from './token.service';
import { IS_PUBLIC_KEY } from './decorators';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let tokenService: {
    mode: 'dev' | 'alb';
    verify: jest.Mock;
    verifyAlbHeaders: jest.Mock;
  };

  const createContext = (
    headers: Record<string, string> = {},
  ): ExecutionContext => {
    const request: { headers: Record<string, string>; user?: unknown } = {
      headers,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    tokenService = {
      mode: 'dev',
      verify: jest.fn(),
      verifyAlbHeaders: jest.fn(),
    };
    guard = new JwtAuthGuard(
      reflector as unknown as Reflector,
      tokenService as unknown as TokenService,
    );
  });

  it('allows public routes without credentials', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      IS_PUBLIC_KEY,
      expect.any(Array),
    );
  });

  it('verifies bearer tokens in dev mode', async () => {
    const user = { sub: '1', username: 'alice', roles: ['Employee'] };
    tokenService.verify.mockResolvedValue(user);
    const context = createContext({ authorization: 'Bearer dev-token' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(tokenService.verify).toHaveBeenCalledWith('dev-token');
    expect(context.switchToHttp().getRequest().user).toEqual(user);
  });

  it('rejects missing bearer tokens in dev mode', async () => {
    await expect(guard.canActivate(createContext())).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('verifies ALB headers in alb mode', async () => {
    tokenService.mode = 'alb';
    const user = { sub: '1', username: 'alice', roles: ['Manager'] };
    tokenService.verifyAlbHeaders.mockResolvedValue(user);
    const context = createContext({
      'x-amzn-oidc-data': 'claims-token',
      'x-amzn-oidc-accesstoken': 'access-token',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(tokenService.verifyAlbHeaders).toHaveBeenCalledWith(
      'claims-token',
      'access-token',
    );
    expect(context.switchToHttp().getRequest().user).toEqual(user);
  });

  it('rejects missing ALB headers in alb mode', async () => {
    tokenService.mode = 'alb';

    await expect(guard.canActivate(createContext())).rejects.toThrow(
      'Missing ALB authentication headers',
    );
  });
});
