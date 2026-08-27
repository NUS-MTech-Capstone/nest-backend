const ALB_REQUIRED_ENV = [
  'AWS_REGION',
  'ALB_ARN',
  'COGNITO_USER_POOL_ID',
  'COGNITO_CLIENT_ID',
] as const;

export function validateMigrationConfig(): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required in production');
  }
}

export function validateRuntimeConfig(): void {
  const authMode = process.env.AUTH_MODE ?? 'dev';
  if (authMode !== 'dev' && authMode !== 'alb') {
    throw new Error('AUTH_MODE must be either "dev" or "alb"');
  }

  validateRedisCacheConfig();

  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  validateMigrationConfig();
  if (authMode !== 'alb') {
    throw new Error('AUTH_MODE=alb is required in production');
  }

  const missing = ALB_REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required production configuration: ${missing.join(', ')}`,
    );
  }
}

function validateRedisCacheConfig(): void {
  const enabled = process.env.REDIS_CACHE_ENABLED ?? 'false';
  if (enabled !== 'true' && enabled !== 'false') {
    throw new Error('REDIS_CACHE_ENABLED must be either "true" or "false"');
  }
  if (enabled === 'true' && !process.env.REDIS_URL?.trim()) {
    throw new Error('REDIS_URL is required when REDIS_CACHE_ENABLED=true');
  }

  const ttl = process.env.MONITORING_CACHE_TTL_SECONDS ?? '60';
  if (
    !/^\d+$/.test(ttl) ||
    !Number.isSafeInteger(Number(ttl)) ||
    Number(ttl) <= 0
  ) {
    throw new Error('MONITORING_CACHE_TTL_SECONDS must be a positive integer');
  }
}
