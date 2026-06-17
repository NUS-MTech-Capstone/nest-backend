import { INestApplication, RequestMethod } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { SERVICE_NAME } from './../src/common/service.constants';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(SERVICE_NAME, {
      exclude: [
        { path: 'healthz', method: RequestMethod.GET },
        { path: 'readyz', method: RequestMethod.GET },
      ],
    });
    await app.init();
  });

  it('GET /healthz', () => {
    return request(app.getHttpServer())
      .get('/healthz')
      .expect(200)
      .expect({ status: 'ok', service: SERVICE_NAME });
  });

  it('GET /readyz', () => {
    return request(app.getHttpServer())
      .get('/readyz')
      .expect(200)
      .expect({ status: 'ready', service: SERVICE_NAME });
  });

  afterEach(async () => {
    await app.close();
  });
});
