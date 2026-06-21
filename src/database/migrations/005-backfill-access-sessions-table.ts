/**
 * 005 — create access_sessions when the table is missing entirely.
 *
 * Backfill migrations 002/003 only add columns and assume the table exists.
 * Some deployments recorded those migrations without ever running 001 fully.
 */
import { DataTypes, QueryInterface } from 'sequelize';
import type { MigrationFn } from 'umzug';

const timestamps = {
  createdAt: { type: DataTypes.DATE, allowNull: false },
  updatedAt: { type: DataTypes.DATE, allowNull: false },
};

async function createIfMissing(
  context: QueryInterface,
  table: string,
  columns: Parameters<QueryInterface['createTable']>[1],
): Promise<void> {
  const tables: string[] = (await context.showAllTables()) as string[];
  if (tables.includes(table)) return;
  await context.createTable(table, columns);
}

export const up: MigrationFn<QueryInterface> = async ({ context }) => {
  await createIfMissing(context, 'access_sessions', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    hostId: { type: DataTypes.TEXT, allowNull: false },
    hostname: { type: DataTypes.TEXT, allowNull: false },
    ipAddress: { type: DataTypes.TEXT, allowNull: true },
    sshPort: { type: DataTypes.INTEGER, allowNull: true },
    crId: { type: DataTypes.UUID, allowNull: true },
    crNumber: { type: DataTypes.TEXT, allowNull: true },
    osUser: { type: DataTypes.TEXT, allowNull: false },
    createdBy: { type: DataTypes.TEXT, allowNull: false },
    status: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: 'active',
    },
    gatewaySessionId: { type: DataTypes.TEXT, allowNull: true },
    sessionToken: { type: DataTypes.TEXT, allowNull: true },
    websocketUrl: { type: DataTypes.TEXT, allowNull: true },
    scopedJwt: { type: DataTypes.TEXT, allowNull: true },
    startedAt: { type: DataTypes.DATE, allowNull: false },
    endedAt: { type: DataTypes.DATE, allowNull: true },
    lastActivityAt: { type: DataTypes.DATE, allowNull: true },
    ...timestamps,
  });

  await context
    .addIndex('access_sessions', {
      name: 'access_sessions_active_host',
      fields: ['status', 'hostId'],
    })
    .catch(() => { /* already exists */ });

  await context
    .addIndex('access_sessions', {
      name: 'access_sessions_created_by_started',
      fields: ['createdBy', 'startedAt'],
    })
    .catch(() => { /* already exists */ });
};

export const down: MigrationFn<QueryInterface> = async () => {
  // no-op
};
