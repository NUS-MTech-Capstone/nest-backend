import {
  validateMigrationConfig,
  validateRuntimeConfig,
} from './runtime.config';

describe('runtime config validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
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
    delete process.env.DATABASE_URL;

    expect(() => validateMigrationConfig()).toThrow(
      'DATABASE_URL is required in production',
    );
  });

  it('requires alb auth settings in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://example';
    process.env.AUTH_MODE = 'dev';

    expect(() => validateRuntimeConfig()).toThrow(
      'AUTH_MODE=alb is required in production',
    );
  });

  it('reports missing alb configuration keys in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://example';
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
