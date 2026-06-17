import type { Options } from 'sequelize';
import type { SequelizeModuleOptions } from '@nestjs/sequelize';

function resolveSslOptions(): Options['dialectOptions'] | undefined {
  if (process.env.DB_SSL !== 'true') {
    return undefined;
  }

  return {
    ssl: {
      require: true,
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
    },
  };
}

function resolvePoolOptions(): Options['pool'] {
  return {
    max: parseInt(process.env.DB_POOL_MAX ?? '10', 10),
    acquire: parseInt(process.env.DB_ACQUIRE_TIMEOUT_MS ?? '10000', 10),
    idle: parseInt(process.env.DB_IDLE_TIMEOUT_MS ?? '10000', 10),
  };
}

function resolveLogging(): Options['logging'] {
  return process.env.DB_LOGGING === 'true' ? console.log : false;
}

/** Shared Sequelize connection options for CLI migrations and runtime. */
export function buildSequelizeOptions(): Options {
  const databaseUrl = process.env.DATABASE_URL;
  const shared: Options = {
    dialect: 'postgres',
    logging: resolveLogging(),
    dialectOptions: resolveSslOptions(),
    pool: resolvePoolOptions(),
  };

  if (databaseUrl) {
    return shared;
  }

  return {
    ...shared,
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'password',
    database: process.env.DB_NAME ?? 'postgres',
  };
}

export function buildDatabaseConfig(
  models: SequelizeModuleOptions['models'],
): SequelizeModuleOptions {
  const databaseUrl = process.env.DATABASE_URL;
  const base = buildSequelizeOptions();

  return {
    ...base,
    ...(databaseUrl ? { url: databaseUrl } : {}),
    models,
    autoLoadModels: true,
    synchronize: false,
  };
}
