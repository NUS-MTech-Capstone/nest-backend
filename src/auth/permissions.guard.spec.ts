import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { PolicyService } from '../identity/policy.service';
import { PERMISSION_KEY } from './decorators';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let policyService: { getPermissionsForRoles: jest.Mock };

  const createContext = (user?: {
    sub: string;
    username: string;
    roles: string[];
  }): ExecutionContext => {
    const request = { user };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    policyService = { getPermissionsForRoles: jest.fn() };
    guard = new PermissionsGuard(
      reflector as unknown as Reflector,
      policyService as unknown as PolicyService,
    );
  });

  it('allows routes without a required permission', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
  });

  it('allows users with the required permission', async () => {
    reflector.getAllAndOverride.mockReturnValue('inventory.view');
    policyService.getPermissionsForRoles.mockResolvedValue(
      new Set(['inventory.view']),
    );

    await expect(
      guard.canActivate(
        createContext({
          sub: '1',
          username: 'alice',
          roles: ['Employee'],
        }),
      ),
    ).resolves.toBe(true);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      PERMISSION_KEY,
      expect.any(Array),
    );
  });

  it('rejects unauthenticated requests', async () => {
    reflector.getAllAndOverride.mockReturnValue('inventory.view');

    await expect(guard.canActivate(createContext())).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects users missing the required permission', async () => {
    reflector.getAllAndOverride.mockReturnValue('inventory.manage');
    policyService.getPermissionsForRoles.mockResolvedValue(
      new Set(['inventory.view']),
    );

    await expect(
      guard.canActivate(
        createContext({
          sub: '1',
          username: 'alice',
          roles: ['Employee'],
        }),
      ),
    ).rejects.toThrow('Missing permission: inventory.manage');
  });
});
