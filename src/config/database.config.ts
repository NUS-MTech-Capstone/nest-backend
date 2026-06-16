import type { SequelizeModuleOptions } from '@nestjs/sequelize';
import type { Options } from 'sequelize';

export function buildDatabaseConfig(
  models: SequelizeModuleOptions['models'],
): SequelizeModuleOptions {
  return {
    ...buildSequelizeOptions(),
    ...(process.env.DATABASE_URL ? { uri: process.env.DATABASE_URL } : {}),
    models,
    autoLoadModels: true,
    synchronize: false,
  };
}

export function buildSequelizeOptions(): Options {
  const useSsl = process.env.DB_SSL === 'true';

  return {
    dialect: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'password',
    database: process.env.DB_NAME ?? 'postgres',
    logging: process.env.DB_LOGGING === 'true' ? console.log : false,
    pool: {
      min: 0,
      max: Number.parseInt(process.env.DB_POOL_MAX ?? '10', 10),
      acquire: Number.parseInt(
        process.env.DB_ACQUIRE_TIMEOUT_MS ?? '10000',
        10,
      ),
      idle: Number.parseInt(process.env.DB_IDLE_TIMEOUT_MS ?? '10000', 10),
    },
    dialectOptions: useSsl
      ? {
          ssl: {
            require: true,
            rejectUnauthorized:
              process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
          },
          connectTimeout: Number.parseInt(
            process.env.DB_CONNECT_TIMEOUT_MS ?? '10000',
            10,
          ),
        }
      : {
          connectTimeout: Number.parseInt(
            process.env.DB_CONNECT_TIMEOUT_MS ?? '10000',
            10,
          ),
        },
  };
}
