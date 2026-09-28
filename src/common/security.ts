import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { API_VERSION_HEADER } from './service.constants';
import { REQUEST_ID_HEADER } from './observability';

const DEFAULT_DEVELOPMENT_ORIGIN = 'http://localhost:4200';

export function configureSecurityHeaders(app: INestApplication): void {
  const express = app.getHttpAdapter().getInstance() as {
    disable(name: string): void;
  };
  express.disable('x-powered-by');
  app.use(securityHeadersMiddleware);
}

export function securityHeadersMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
}

export function configureCors(
  app: INestApplication,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const corsEnabled =
    env.CORS_ENABLED === 'true' ||
    (env.CORS_ENABLED !== 'false' && env.NODE_ENV !== 'production');

  if (!corsEnabled) {
    return;
  }

  const origins = parseCorsOrigins(
    env.CORS_ORIGINS ?? DEFAULT_DEVELOPMENT_ORIGIN,
  );

  app.enableCors({
    origin: origins.length === 1 ? origins[0] : origins,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      API_VERSION_HEADER,
      REQUEST_ID_HEADER,
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: false,
  });
}

export function parseCorsOrigins(value: string): string[] {
  const configured = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configured.length === 0) {
    throw new Error('CORS_ORIGINS must contain at least one origin');
  }

  return configured.map((origin) => {
    if (origin === '*') {
      throw new Error('CORS_ORIGINS must not contain a wildcard');
    }

    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`CORS_ORIGINS contains an invalid origin: ${origin}`);
    }
    if (
      (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
      parsed.origin !== origin
    ) {
      throw new Error(
        `CORS_ORIGINS must contain exact HTTP origins: ${origin}`,
      );
    }
    return parsed.origin;
  });
}
