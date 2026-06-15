import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
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
    await app.init();
  });

  it(`GET /${SERVICE_NAME}/health`, () => {
    return request(app.getHttpServer())
      .get(`/${SERVICE_NAME}/health`)
      .expect(200)
      .expect({ status: 'ok', service: SERVICE_NAME });
  });

  it(`GET /${SERVICE_NAME}/ready`, () => {
    return request(app.getHttpServer())
      .get(`/${SERVICE_NAME}/ready`)
      .expect(200)
      .expect({ status: 'ready', service: SERVICE_NAME });
  });

  afterEach(async () => {
    await app.close();
  });
});
