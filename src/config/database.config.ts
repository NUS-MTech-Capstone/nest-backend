import type { SequelizeModuleOptions } from '@nestjs/sequelize';

export function buildDatabaseConfig(
  models: SequelizeModuleOptions['models'],
): SequelizeModuleOptions {
  return {
    dialect: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'password',
    database: process.env.DB_NAME ?? 'postgres',
    models,
    autoLoadModels: true,
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.DB_LOGGING === 'true' ? console.log : false,
  };
}
