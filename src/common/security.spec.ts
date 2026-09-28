import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import {
  configureCors,
  configureSecurityHeaders,
  parseCorsOrigins,
  securityHeadersMiddleware,
} from './security';

describe('security hardening', () => {
  it('sets safe API response headers', () => {
    const setHeader = jest.fn();
    const next = jest.fn();

    securityHeadersMiddleware(
      {} as Request,
      { setHeader } as unknown as Response,
      next as NextFunction,
    );

    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    expect(setHeader).toHaveBeenCalledWith('Referrer-Policy', 'no-referrer');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('disables the Express banner and installs the middleware', () => {
    const disable = jest.fn();
    const use = jest.fn();
    const app = {
      getHttpAdapter: () => ({ getInstance: () => ({ disable }) }),
      use,
    } as unknown as INestApplication;

    configureSecurityHeaders(app);

    expect(disable).toHaveBeenCalledWith('x-powered-by');
    expect(use).toHaveBeenCalledWith(securityHeadersMiddleware);
  });

  it('keeps CORS disabled by default in production', () => {
    const enableCors = jest.fn();
    configureCors({ enableCors } as unknown as INestApplication, {
      NODE_ENV: 'production',
    });
    expect(enableCors).not.toHaveBeenCalled();
  });

  it('allows only configured exact local origins without credentials', () => {
    const enableCors = jest.fn();
    configureCors({ enableCors } as unknown as INestApplication, {
      NODE_ENV: 'development',
      CORS_ORIGINS: 'http://localhost:4200, http://127.0.0.1:4200',
    });

    expect(enableCors).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: ['http://localhost:4200', 'http://127.0.0.1:4200'],
        credentials: false,
      }),
    );
  });

  it('rejects wildcard and malformed origins', () => {
    expect(() => parseCorsOrigins('*')).toThrow('must not contain a wildcard');
    expect(() => parseCorsOrigins('localhost:4200')).toThrow(
      'must contain exact HTTP origins',
    );
    expect(() => parseCorsOrigins('')).toThrow(
      'must contain at least one origin',
    );
  });
});
