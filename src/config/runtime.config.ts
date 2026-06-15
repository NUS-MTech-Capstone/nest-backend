const ALB_REQUIRED_ENV = [
  'AWS_REGION',
  'ALB_ARN',
  'COGNITO_USER_POOL_ID',
  'COGNITO_CLIENT_ID',
] as const;

export function validateRuntimeConfig(): void {
  const authMode = process.env.AUTH_MODE ?? 'dev';
  if (authMode !== 'dev' && authMode !== 'alb') {
    throw new Error('AUTH_MODE must be either "dev" or "alb"');
  }

  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required in production');
  }
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
