import {
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { TokenService } from './token.service';

describe('TokenService ALB authentication', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('binds the ALB identity to the Cognito subject and groups', async () => {
    const service = new TokenService();
    Object.assign(service, {
      albVerifier: {
        verify: jest.fn().mockResolvedValue({
          sub: 'user-123',
          username: 'alice',
          email: 'alice@example.com',
        }),
      },
      cognitoVerifier: {
        verify: jest.fn().mockResolvedValue({
          sub: 'user-123',
          'cognito:groups': ['Manager', 'Auditor'],
        }),
      },
    });

    await expect(
      service.verifyAlbHeaders('claims-token', 'access-token'),
    ).resolves.toEqual({
      sub: 'user-123',
      username: 'alice',
      email: 'alice@example.com',
      name: undefined,
      roles: ['Manager', 'Auditor'],
    });
  });

  it('rejects mismatched ALB and Cognito subjects', async () => {
    const service = new TokenService();
    Object.assign(service, {
      albVerifier: {
        verify: jest.fn().mockResolvedValue({ sub: 'user-123' }),
      },
      cognitoVerifier: {
        verify: jest.fn().mockResolvedValue({ sub: 'user-456' }),
      },
    });

    await expect(
      service.verifyAlbHeaders('claims-token', 'access-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('TokenService dev authentication', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      AUTH_MODE: 'dev',
      DEV_JWT_SECRET: 'test-secret',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('issues and verifies a dev token for a known user', async () => {
    const service = new TokenService();
    const { accessToken } = service.issueDevToken('employee.dev');

    await expect(service.verify(accessToken)).resolves.toEqual(
      expect.objectContaining({
        username: 'employee.dev',
        roles: ['Employee'],
      }),
    );
  });

  it('rejects unknown dev users', () => {
    const service = new TokenService();

    expect(() => service.issueDevToken('unknown.dev')).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects invalid bearer tokens', async () => {
    const service = new TokenService();

    await expect(service.verify('not-a-jwt')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects bearer verification when mode is alb', async () => {
    process.env.AUTH_MODE = 'alb';
    const service = new TokenService();

    await expect(service.verify('token')).rejects.toThrow(
      'Bearer tokens are not used when AUTH_MODE=alb',
    );
  });

  it('disables dev login when mode is alb', () => {
    process.env.AUTH_MODE = 'alb';
    const service = new TokenService();

    expect(() => service.issueDevToken('employee.dev')).toThrow(
      BadRequestException,
    );
  });
});
