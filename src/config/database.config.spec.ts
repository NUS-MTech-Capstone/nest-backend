import {
  buildDatabaseConfig,
  buildSequelizeOptions,
} from './database.config';

describe('database config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('builds local sequelize options from DB_* variables', () => {
    process.env.DB_HOST = 'db.local';
    process.env.DB_PORT = '5433';
    process.env.DB_USER = 'ddm';
    process.env.DB_PASSWORD = 'secret';
    process.env.DB_NAME = 'ddm_webapp';

    expect(buildSequelizeOptions()).toEqual(
      expect.objectContaining({
        dialect: 'postgres',
        host: 'db.local',
        port: 5433,
        username: 'ddm',
        password: 'secret',
        database: 'ddm_webapp',
      }),
    );
  });

  it('uses DATABASE_URL in nest database config', () => {
    process.env.DATABASE_URL = 'postgres://user:pass@db:5432/ddm';

    const config = buildDatabaseConfig([]);

    expect(config.url).toBe('postgres://user:pass@db:5432/ddm');
    expect(config.synchronize).toBe(false);
  });

  it('enables ssl dialect options when DB_SSL=true', () => {
    process.env.DB_SSL = 'true';

    expect(buildSequelizeOptions().dialectOptions).toEqual({
      ssl: {
        require: true,
        rejectUnauthorized: true,
      },
    });
  });
});
