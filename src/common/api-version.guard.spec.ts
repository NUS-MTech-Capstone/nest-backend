import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiVersionGuard } from './api-version.guard';
import {
  API_VERSION_HEADER,
  SERVICE_NAME,
  SUPPORTED_API_VERSION,
} from './service.constants';
import { IS_PUBLIC_KEY } from '../auth/decorators';

describe('ApiVersionGuard', () => {
  let guard: ApiVersionGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  const createContext = (
    path: string,
    headers: Record<string, string> = {},
  ): ExecutionContext => {
    const handler = jest.fn();
    const clazz = jest.fn();
    return {
      switchToHttp: () => ({
        getRequest: () => ({ path, headers }),
      }),
      getHandler: () => handler,
      getClass: () => clazz,
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    guard = new ApiVersionGuard(reflector as unknown as Reflector);
  });

  it('allows public routes without version header', () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    expect(guard.canActivate(createContext('/ddm/auth/config'))).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      IS_PUBLIC_KEY,
      expect.any(Array),
    );
  });

  it('allows probe paths without version header', () => {
    expect(guard.canActivate(createContext('/healthz'))).toBe(true);
    expect(guard.canActivate(createContext('/readyz'))).toBe(true);
  });

  it('allows @Public server inventory routes without version header', () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    expect(guard.canActivate(createContext('/servers/host-dev-1'))).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      IS_PUBLIC_KEY,
      expect.any(Array),
    );
  });

  it('allows requests with supported version header', () => {
    expect(
      guard.canActivate(
        createContext('/ddm/change-requests', {
          [API_VERSION_HEADER]: SUPPORTED_API_VERSION,
        }),
      ),
    ).toBe(true);
  });

  it('rejects requests with missing or unsupported version header', () => {
    expect(() => guard.canActivate(createContext('/ddm/change-requests'))).toThrow(
      BadRequestException,
    );
    expect(() =>
      guard.canActivate(
        createContext('/ddm/change-requests', {
          [API_VERSION_HEADER]: '99',
        }),
      ),
    ).toThrow(
      `Missing or unsupported ${API_VERSION_HEADER}. Expected "${SUPPORTED_API_VERSION}".`,
    );
  });
});
