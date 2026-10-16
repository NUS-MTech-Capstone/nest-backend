import {
  validateMigrationConfig,
  validateRuntimeConfig,
} from './runtime.config';

describe('runtime config validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.DB_SSL;
    delete process.env.DB_SSL_REJECT_UNAUTHORIZED;
    delete process.env.REDIS_CACHE_ENABLED;
    delete process.env.REDIS_URL;
    delete process.env.MONITORING_CACHE_TTL_SECONDS;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('allows development configuration without production requirements', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.DATABASE_URL;

    expect(() => validateRuntimeConfig()).not.toThrow();
  });

  it('requires DATABASE_URL for production migrations', () => {
    process.env.NODE_ENV = 'production';
    process.env.DB_SSL = 'true';
    delete process.env.DATABASE_URL;

    expect(() => validateMigrationConfig()).toThrow(
      'DATABASE_URL is required in production',
    );
  });

  it.each([undefined, 'false'])(
    'requires DB_SSL=true for production migrations when DB_SSL=%s',
    (dbSsl) => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgres://example';
      if (dbSsl === undefined) {
        delete process.env.DB_SSL;
      } else {
        process.env.DB_SSL = dbSsl;
      }

      expect(() => validateMigrationConfig()).toThrow(
        'DB_SSL=true is required in production',
      );
    },
  );

  it('allows production migrations with DATABASE_URL and DB_SSL=true', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://example';
    process.env.DB_SSL = 'true';

    expect(() => validateMigrationConfig()).not.toThrow();
  });

  it('requires alb auth settings in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://example';
    process.env.DB_SSL = 'true';
    process.env.AUTH_MODE = 'dev';

    expect(() => validateRuntimeConfig()).toThrow(
      'AUTH_MODE=alb is required in production',
    );
  });

  it('reports missing alb configuration keys in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://example';
    process.env.DB_SSL = 'true';
    process.env.AUTH_MODE = 'alb';
    delete process.env.AWS_REGION;

    expect(() => validateRuntimeConfig()).toThrow(
      'Missing required production configuration: AWS_REGION',
    );
  });

  it('allows disabled Redis caching with default settings', () => {
    process.env.NODE_ENV = 'development';

    expect(() => validateRuntimeConfig()).not.toThrow();
  });

  it('requires REDIS_URL when Redis caching is enabled', () => {
    process.env.NODE_ENV = 'development';
    process.env.REDIS_CACHE_ENABLED = 'true';

    expect(() => validateRuntimeConfig()).toThrow(
      'REDIS_URL is required when REDIS_CACHE_ENABLED=true',
    );
  });

  it('rejects invalid Redis cache flags and TTLs', () => {
    process.env.NODE_ENV = 'development';
    process.env.REDIS_CACHE_ENABLED = 'yes';

    expect(() => validateRuntimeConfig()).toThrow(
      'REDIS_CACHE_ENABLED must be either "true" or "false"',
    );

    process.env.REDIS_CACHE_ENABLED = 'false';
    process.env.MONITORING_CACHE_TTL_SECONDS = '0';

    expect(() => validateRuntimeConfig()).toThrow(
      'MONITORING_CACHE_TTL_SECONDS must be a positive integer',
    );
  });
});
