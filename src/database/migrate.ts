import 'dotenv/config';
import { Sequelize } from 'sequelize';
import { SequelizeStorage, Umzug } from 'umzug';
import { buildSequelizeOptions } from '../config/database.config';
import { validateMigrationConfig } from '../config/runtime.config';

async function migrate(): Promise<void> {
  validateMigrationConfig();
  const databaseUrl = process.env.DATABASE_URL;
  const sequelize = databaseUrl
    ? new Sequelize(databaseUrl, buildSequelizeOptions())
    : new Sequelize(buildSequelizeOptions());
  const migrator = new Umzug({
    migrations: {
      glob: ['migrations/*.js', { cwd: __dirname }],
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger: console,
  });

  try {
    await sequelize.authenticate();
    await migrator.up();
  } finally {
    await sequelize.close();
  }
}

migrate().catch((err: unknown) => {
  console.error('[migrate] FATAL: migration failed — app will not start', err);
  process.exit(1);
});
