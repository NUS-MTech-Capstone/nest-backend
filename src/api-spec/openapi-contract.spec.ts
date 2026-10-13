import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import request from 'supertest';
import { parse } from 'yaml';
import { ApiSpecController } from './api-spec.controller';
import { ApiSpecService } from './api-spec.service';
import { HealthController } from '../health/health.controller';
import { AuthController } from '../auth/auth.controller';
import { TokenService } from '../auth/token.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { ApiVersionGuard } from '../common/api-version.guard';
import { IdentityController } from '../identity/identity.controller';
import { IdentityUserService } from '../identity/identity-user.service';
import { PolicyService } from '../identity/policy.service';
import { InventoryController } from '../inventory/inventory.controller';
import { InventoryService } from '../inventory/inventory.service';

const specBytes = readFileSync(resolve(__dirname, '../../api/openapi.yaml'), 'utf8');
const spec = parse(specBytes);
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const validators = new Map<string, ReturnType<typeof ajv.compile>>();

function conforms(path: string, method: string, status: number, value: unknown) {
  const key = `${method} ${path} ${status}`;
  let validate = validators.get(key);
  if (!validate) {
    let response = spec.paths[path][method].responses[String(status)];
    expect(response).toBeDefined();
    if (response.$ref) response = spec.components.responses[response.$ref.split('/').pop()];
    const schema = response.content['application/json'].schema;
    validate = ajv.compile({ ...schema, components: spec.components });
    validators.set(key, validate);
  }
  expect({ valid: validate(value), errors: validate.errors ?? null }).toEqual({ valid: true, errors: null });
}

describe('OpenAPI contracts through real Nest routes, guards and validation', () => {
  let app: INestApplication;
  const database = { query: jest.fn().mockResolvedValue([]) };
  const policies = { getPermissionsForRoles: jest.fn().mockResolvedValue(new Set(['inventory.view', 'inventory.manage', 'identity.users.view'])) };
  const inventory = { findAll: jest.fn().mockResolvedValue([]), create: jest.fn() };
  const user = { sub: 'contract-user', username: 'contract-user', roles: ['Admin'] };
  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      controllers: [ApiSpecController, HealthController, AuthController, IdentityController, InventoryController],
      providers: [ApiSpecService,
        { provide: getConnectionToken(), useValue: database },
        { provide: TokenService, useValue: { mode: 'dev', verify: jest.fn().mockResolvedValue(user), issueDevToken: jest.fn().mockReturnValue({ accessToken: 'fixture-only', user }) } },
        { provide: PolicyService, useValue: policies },
        { provide: IdentityUserService, useValue: { listUsers: jest.fn().mockResolvedValue([{ username: 'contract-user', roles: ['Admin'], enabled: true, status: 'CONFIRMED' }]) } },
        { provide: InventoryService, useValue: inventory },
      ],
    }).compile();
    app = fixture.createNestApplication();
    app.useLogger(false);
    app.setGlobalPrefix('ddm', { exclude: ['healthz', 'readyz', 'openapi.yaml'].map(path => ({ path, method: RequestMethod.GET })) });
    app.useGlobalGuards(new ApiVersionGuard(), new JwtAuthGuard(fixture.get(Reflector), fixture.get(TokenService)), new PermissionsGuard(fixture.get(Reflector), fixture.get(PolicyService)));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false }));
    await app.init();
  });
  afterAll(async () => { await app.close(); });

  it('serves the exact checked-in document and exempt probes', async () => {
    expect((await request(app.getHttpServer()).get('/openapi.yaml').expect(200)).text).toBe(specBytes);
    for (const path of ['/healthz', '/readyz']) {
      const result = await request(app.getHttpServer()).get(path).expect(200);
      conforms(path, 'get', 200, result.body);
    }
    database.query.mockRejectedValueOnce(new Error('isolated database failure'));
    const unavailable = await request(app.getHttpServer()).get('/readyz').expect(503);
    conforms('/readyz', 'get', 503, unavailable.body);
  });

  it.each(['/ddm/auth/config', '/ddm/auth/me', '/ddm/identity/roles', '/ddm/identity/users', '/ddm/inventory/vms'])('validates %s success and version errors', async path => {
    const result = await request(app.getHttpServer()).get(path).set('x-api-version', '1').set('Authorization', 'Bearer fixture-only').expect(200);
    conforms(path, 'get', 200, result.body);
    for (const version of ['', 'unsupported']) {
      const invalid = await request(app.getHttpServer()).get(path).set('x-api-version', version).expect(400);
      conforms(path, 'get', 400, invalid.body);
    }
  });

  it('documents actual POST status and rejects invalid bodies and missing identity', async () => {
    const login = await request(app.getHttpServer()).post('/ddm/auth/dev-login').set('x-api-version', '1').send({ username: 'contract-user' }).expect(201);
    conforms('/ddm/auth/dev-login', 'post', 201, login.body);
    const invalid = await request(app.getHttpServer()).post('/ddm/inventory/vms').set('x-api-version', '1').set('Authorization', 'Bearer fixture-only').send({ sshPort: 0 }).expect(400);
    conforms('/ddm/inventory/vms', 'post', 400, invalid.body);
    expect(inventory.create).not.toHaveBeenCalled();
    const denied = await request(app.getHttpServer()).get('/ddm/identity/users').set('x-api-version', '1').expect(401);
    conforms('/ddm/identity/users', 'get', 401, denied.body);
  });
});
