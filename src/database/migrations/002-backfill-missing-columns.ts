/**
 * Backfill columns that were added to 001-initial-schema.ts after the
 * production database was first provisioned.
 *
 * - change_requests.scheduledDate  (DATE, nullable)
 * - access_sessions.gatewaySessionId (TEXT, nullable)
 *
 * Each addColumn is wrapped in an existence check so the migration is
 * idempotent — safe to re-run even if the column already exists.
 */
import { DataTypes, QueryInterface } from 'sequelize';
import type { MigrationFn } from 'umzug';

async function addIfMissing(
  context: QueryInterface,
  table: string,
  column: string,
  definition: Parameters<QueryInterface['addColumn']>[2],
): Promise<void> {
  const desc = await context.describeTable(table).catch(() => ({}));
  if (column in desc) return;
  await context.addColumn(table, column, definition);
}

export const up: MigrationFn<QueryInterface> = async ({ context }) => {
  await addIfMissing(context, 'change_requests', 'scheduledDate', {
    type: DataTypes.DATE,
    allowNull: true,
  });

  await addIfMissing(context, 'access_sessions', 'gatewaySessionId', {
    type: DataTypes.TEXT,
    allowNull: true,
  });
};

export const down: MigrationFn<QueryInterface> = async ({ context }) => {
  const crDesc = await context.describeTable('change_requests').catch(() => ({}));
  if ('scheduledDate' in crDesc) {
    await context.removeColumn('change_requests', 'scheduledDate');
  }

  const asDesc = await context.describeTable('access_sessions').catch(() => ({}));
  if ('gatewaySessionId' in asDesc) {
    await context.removeColumn('access_sessions', 'gatewaySessionId');
  }
};
