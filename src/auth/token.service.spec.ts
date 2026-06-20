import { createSign, generateKeyPairSync } from 'crypto';
import {
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { TokenService } from './token.service';

// ── Test helpers ──────────────────────────────────────────────────────────────

/** Build a minimal ES256 JWT signed with the given private key PEM.
 *  Uses IEEE P1363 (raw R||S) encoding to match the JWT spec — Node.js
 *  defaults to DER, which would produce invalid JWT signatures. */
function makeAlbToken(
  payload: Record<string, unknown>,
  privateKeyPem: string,
  kid = 'test-kid',
  overrideHeader?: Record<string, unknown>,
): string {
  const header = { typ: 'JWT', alg: 'ES256', kid, ...overrideHeader };
  const b64 = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  const signable = `${b64(header)}.${b64(payload)}`;
  const sig = createSign('SHA256')
    .update(signable)
    .sign({ key: privateKeyPem, dsaEncoding: 'ieee-p1363' });
  return `${signable}.${sig.toString('base64url')}`;
}

const EC_PAIR = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const PRIVATE_KEY_PEM = EC_PAIR.privateKey
  .export({ type: 'pkcs8', format: 'pem' })
  .toString();
const PUBLIC_KEY_PEM = EC_PAIR.publicKey
  .export({ type: 'spki', format: 'pem' })
  .toString();

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

describe('TokenService verifyAlbOidcDataToken (crypto path)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      AUTH_MODE: 'alb',
      AWS_REGION: 'ap-southeast-1',
      ALB_ARN: 'arn:aws:elasticloadbalancing:ap-southeast-1:123:loadbalancer/app/ddm/abc',
      COGNITO_USER_POOL_ID: 'ap-southeast-1_TEST',
      COGNITO_CLIENT_ID: 'client-id',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  function makeService() {
    const svc = new TokenService();
    // Stub the public-key fetch so tests never hit the real AWS endpoint.
    jest
      .spyOn(svc as any, 'getAlbPublicKey')
      .mockResolvedValue(PUBLIC_KEY_PEM);
    return svc;
  }

  it('verifies a structurally-valid ES256 JWT and returns its payload', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = makeAlbToken(
      {
        sub: 'user-abc',
        'cognito:username': 'alice',
        email: 'alice@example.com',
        iat: now - 10,
        exp: now + 3600,
      },
      PRIVATE_KEY_PEM,
    );

    const svc = makeService();
    const payload = await (svc as any).verifyAlbOidcDataToken(token);
    expect(payload.sub).toBe('user-abc');
    expect(payload['cognito:username']).toBe('alice');
  });

  it('rejects a token with the wrong number of parts', async () => {
    const svc = makeService();
    await expect(
      (svc as any).verifyAlbOidcDataToken('only.two'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token with a tampered signature', async () => {
    const token = makeAlbToken({ sub: 'x', exp: Math.floor(Date.now() / 1000) + 3600 }, PRIVATE_KEY_PEM);
    const parts = token.split('.');
    const tampered = `${parts[0]}.${parts[1]}.AAAA`;

    const svc = makeService();
    await expect(
      (svc as any).verifyAlbOidcDataToken(tampered),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an expired token', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = makeAlbToken(
      { sub: 'user-abc', iat: now - 7200, exp: now - 3600 },
      PRIVATE_KEY_PEM,
    );

    const svc = makeService();
    await expect(
      (svc as any).verifyAlbOidcDataToken(token),
    ).rejects.toThrow('expired');
  });

  it('handles tokens with embedded whitespace (proxy header folding)', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = makeAlbToken({ sub: 'user-abc', exp: now + 3600 }, PRIVATE_KEY_PEM);
    // Simulate a proxy inserting a newline inside the token.
    const parts = token.split('.');
    const folded = `${parts[0]}\n ${parts[1]}.${parts[2]}`;

    const svc = makeService();
    const payload = await (svc as any).verifyAlbOidcDataToken(folded);
    expect(payload.sub).toBe('user-abc');
  });

  it('rejects when AWS_REGION or ALB_ARN are missing', async () => {
    delete process.env.AWS_REGION;
    const svc = new TokenService();
    await expect(
      (svc as any).verifyAlbOidcDataToken('a.b.c'),
    ).rejects.toThrow(UnauthorizedException);
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
