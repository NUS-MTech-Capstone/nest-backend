import 'dotenv/config';
import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SERVICE_NAME } from './common/service.constants';
import { JsonLogger } from './common/observability';
import { configureCors, configureSecurityHeaders } from './common/security';
import { validateRuntimeConfig } from './config/runtime.config';

async function bootstrap() {
  validateRuntimeConfig();

  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: new JsonLogger(),
  });
  app.enableShutdownHooks();
  configureSecurityHeaders(app);

  app.setGlobalPrefix(SERVICE_NAME, {
    exclude: [
      { path: 'healthz', method: RequestMethod.GET },
      { path: 'readyz', method: RequestMethod.GET },
      { path: 'openapi.yaml', method: RequestMethod.GET },
      { path: 'servers/:hostId', method: RequestMethod.GET },
      { path: 'sts/change-requests/:id', method: RequestMethod.GET },
    ],
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false }),
  );
  configureCors(app);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`${SERVICE_NAME} service listening on port ${port}`);
  logger.log(`Health: http://localhost:${port}/healthz`);
  logger.log(`Ready: http://localhost:${port}/readyz`);
  logger.log(
    `Auth config: http://localhost:${port}/${SERVICE_NAME}/auth/config`,
  );
  if (
    process.env.CORS_ENABLED !== 'false' &&
    process.env.NODE_ENV !== 'production'
  ) {
    logger.log('CORS enabled for local frontend development');
  }
}
void bootstrap();
