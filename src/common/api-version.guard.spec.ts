import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { ApiVersionGuard } from './api-version.guard';
import {
  API_VERSION_HEADER,
  SUPPORTED_API_VERSION,
} from './service.constants';

describe('ApiVersionGuard', () => {
  let guard: ApiVersionGuard;

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
    guard = new ApiVersionGuard();
  });

  it('allows probe paths without version header', () => {
    expect(guard.canActivate(createContext('/healthz'))).toBe(true);
    expect(guard.canActivate(createContext('/readyz'))).toBe(true);
  });

  it('allows explicit browser and spec exemptions without version header', () => {
    expect(guard.canActivate(createContext('/'))).toBe(true);
    expect(guard.canActivate(createContext('/openapi.yaml'))).toBe(true);
    expect(guard.canActivate(createContext('/ddm/auth/login'))).toBe(true);
    expect(guard.canActivate(createContext('/ddm/auth/logout'))).toBe(true);
    expect(guard.canActivate(createContext('/ddm/monitoring/alerts/webhook'))).toBe(true);
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
    expect(() => guard.canActivate(createContext('/ddm/auth/config'))).toThrow(
      BadRequestException,
    );
    expect(() => guard.canActivate(createContext('/servers/host-dev-1'))).toThrow(
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
