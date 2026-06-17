import 'dotenv/config';
import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  API_VERSION_HEADER,
  SERVICE_NAME,
} from './common/service.constants';
import { validateRuntimeConfig } from './config/runtime.config';

function configureCors(app: INestApplication): void {
  const corsEnabled =
    process.env.CORS_ENABLED === 'true' ||
    (process.env.CORS_ENABLED !== 'false' &&
      process.env.NODE_ENV !== 'production');

  if (!corsEnabled) {
    return;
  }

  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:4200')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origins.length === 1 ? origins[0] : origins,
    allowedHeaders: ['Content-Type', 'Authorization', API_VERSION_HEADER],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
}

async function bootstrap() {
  validateRuntimeConfig();

  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  app.setGlobalPrefix(SERVICE_NAME, {
    exclude: [
      { path: 'healthz', method: RequestMethod.GET },
      { path: 'readyz', method: RequestMethod.GET },
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
  logger.log(`Auth config: http://localhost:${port}/${SERVICE_NAME}/auth/config`);
  if (process.env.CORS_ENABLED !== 'false' && process.env.NODE_ENV !== 'production') {
    logger.log('CORS enabled for local frontend development');
  }
}
bootstrap();
