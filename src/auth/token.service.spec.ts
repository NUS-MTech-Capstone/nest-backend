import { UnauthorizedException } from '@nestjs/common';
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
