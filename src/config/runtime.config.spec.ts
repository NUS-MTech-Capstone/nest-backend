import {
  validateMigrationConfig,
  validateRuntimeConfig,
} from './runtime.config';

describe('runtime config validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
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
});
