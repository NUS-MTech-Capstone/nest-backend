import 'dotenv/config';
import { Sequelize } from 'sequelize';
import { SequelizeStorage, Umzug } from 'umzug';
import { buildDatabaseConfig } from '../config/database.config';
import { validateRuntimeConfig } from '../config/runtime.config';

async function migrate(): Promise<void> {
  validateRuntimeConfig();
  const sequelize = new Sequelize(buildDatabaseConfig([]));
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

void migrate();
