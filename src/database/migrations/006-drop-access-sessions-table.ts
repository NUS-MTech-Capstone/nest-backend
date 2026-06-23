import { QueryInterface } from 'sequelize';
import type { MigrationFn } from 'umzug';

async function tableExists(context: QueryInterface, table: string): Promise<boolean> {
  const tables = (await context.showAllTables()) as unknown[];
  return tables.some((entry) => {
    if (typeof entry === 'string') return entry === table;
    if (entry && typeof entry === 'object') {
      return Object.values(entry as Record<string, unknown>).includes(table);
    }
    return false;
  });
}

export const up: MigrationFn<QueryInterface> = async ({ context }) => {
  if (!(await tableExists(context, 'access_sessions'))) {
    return;
  }
  await context.dropTable('access_sessions', { cascade: true });
};

export const down: MigrationFn<QueryInterface> = async () => {
  // no-op: SSH session ownership now lives outside nest-backend.
};
