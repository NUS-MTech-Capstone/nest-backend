/**
 * 003 — comprehensive schema sync (continuation of 002).
 *
 * 002 was already recorded in SequelizeMeta on existing deployments, so any
 * columns not covered by the original 002 content must be added here.
 *
 * Every operation is idempotent:
 *  • addIfMissing  — skips if the column already exists.
 *  • backfillJsonb — sets NULL → '[]' after adding a JSONB NOT-NULL column.
 *  • createIfMissing — skips if the table already exists.
 *  • addConstraint / addIndex calls swallow "already exists" errors.
 */
import { DataTypes, QueryInterface } from 'sequelize';
import type { MigrationFn } from 'umzug';

// ── Helpers ────────────────────────────────────────────────────────────────

type ColDef = Parameters<QueryInterface['addColumn']>[2];

async function addIfMissing(
  context: QueryInterface,
  table: string,
  column: string,
  definition: ColDef,
): Promise<void> {
  const desc = await context.describeTable(table).catch(() => undefined);
  if (!desc) return;
  if (column in desc) return;
  await context.addColumn(table, column, definition);
}

async function backfillJsonb(
  context: QueryInterface,
  table: string,
  column: string,
): Promise<void> {
  const desc = await context.describeTable(table).catch(() => undefined);
  if (!desc) return;
  await context.sequelize.query(
    `UPDATE "${table}" SET "${column}" = '[]'::jsonb WHERE "${column}" IS NULL`,
  );
}

async function createIfMissing(
  context: QueryInterface,
  table: string,
  columns: Parameters<QueryInterface['createTable']>[1],
): Promise<void> {
  const tables: string[] = (await context.showAllTables()) as string[];
  if (tables.includes(table)) return;
  await context.createTable(table, columns);
}

const timestamps = {
  createdAt: { type: DataTypes.DATE, allowNull: false },
  updatedAt: { type: DataTypes.DATE, allowNull: false },
};

// ── Up ─────────────────────────────────────────────────────────────────────

export const up: MigrationFn<QueryInterface> = async ({ context }) => {

  // ── virtual_machines ──────────────────────────────────────────────────
  await addIfMissing(context, 'virtual_machines', 'tags', {
    type: DataTypes.JSONB,
    allowNull: true,
  });
  await backfillJsonb(context, 'virtual_machines', 'tags');

  // ── implementer_groups ────────────────────────────────────────────────
  await addIfMissing(context, 'implementer_groups', 'description', {
    type: DataTypes.TEXT,
    allowNull: true,
  });
  await addIfMissing(context, 'implementer_groups', 'osUsers', {
    type: DataTypes.JSONB,
    allowNull: true,
  });
  await backfillJsonb(context, 'implementer_groups', 'osUsers');
  await addIfMissing(context, 'implementer_groups', 'vmIds', {
    type: DataTypes.JSONB,
    allowNull: true,
  });
  await backfillJsonb(context, 'implementer_groups', 'vmIds');

  // ── change_requests ───────────────────────────────────────────────────
  await addIfMissing(context, 'change_requests', 'activities', {
    type: DataTypes.JSONB,
    allowNull: true,
  });
  await backfillJsonb(context, 'change_requests', 'activities');
  await addIfMissing(context, 'change_requests', 'vmIds', {
    type: DataTypes.JSONB,
    allowNull: true,
  });
  await backfillJsonb(context, 'change_requests', 'vmIds');
  await addIfMissing(context, 'change_requests', 'allowedRoles', {
    type: DataTypes.JSONB,
    allowNull: true,
  });
  await backfillJsonb(context, 'change_requests', 'allowedRoles');
  await addIfMissing(context, 'change_requests', 'implementerGroupIds', {
    type: DataTypes.JSONB,
    allowNull: true,
  });
  await backfillJsonb(context, 'change_requests', 'implementerGroupIds');
  await addIfMissing(context, 'change_requests', 'scheduledDate', {
    type: DataTypes.DATE,
    allowNull: true,
  });

  // ── access_sessions ───────────────────────────────────────────────────
  await addIfMissing(context, 'access_sessions', 'crNumber', {
    type: DataTypes.TEXT,
    allowNull: true,
  });
  await addIfMissing(context, 'access_sessions', 'gatewaySessionId', {
    type: DataTypes.TEXT,
    allowNull: true,
  });
  await addIfMissing(context, 'access_sessions', 'sessionToken', {
    type: DataTypes.TEXT,
    allowNull: true,
  });
  await addIfMissing(context, 'access_sessions', 'websocketUrl', {
    type: DataTypes.TEXT,
    allowNull: true,
  });
  await addIfMissing(context, 'access_sessions', 'scopedJwt', {
    type: DataTypes.TEXT,
    allowNull: true,
  });
  await addIfMissing(context, 'access_sessions', 'lastActivityAt', {
    type: DataTypes.DATE,
    allowNull: true,
  });

  // ── implementerGroupMembers (may be absent) ───────────────────────────
  await createIfMissing(context, 'implementerGroupMembers', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    username: { type: DataTypes.TEXT, allowNull: false },
    implementerGroupId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'implementer_groups', key: 'id' },
      onDelete: 'CASCADE',
    },
    ...timestamps,
  });
  await context
    .addConstraint('implementerGroupMembers', {
      name: 'implementer_group_members_user_group_unique',
      type: 'unique',
      fields: ['username', 'implementerGroupId'],
    })
    .catch(() => { /* already exists */ });

  // ── implementerGroupMembershipRequests (may be absent) ────────────────
  await context.sequelize.query(`
    DO $$ BEGIN
      CREATE TYPE "enum_implementerGroupMembershipRequests_status"
        AS ENUM ('Pending', 'Approved', 'Rejected');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `);
  await createIfMissing(context, 'implementerGroupMembershipRequests', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    username: { type: DataTypes.TEXT, allowNull: false },
    implementerGroupId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'implementer_groups', key: 'id' },
      onDelete: 'CASCADE',
    },
    requester: { type: DataTypes.TEXT, allowNull: false },
    status: {
      type: DataTypes.ENUM('Pending', 'Approved', 'Rejected'),
      allowNull: false,
      defaultValue: 'Pending',
    },
    comments: { type: DataTypes.TEXT, allowNull: true },
    approver: { type: DataTypes.TEXT, allowNull: true },
    history: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    ...timestamps,
  });
  await context
    .addIndex('implementerGroupMembershipRequests', {
      name: 'membership_requests_pending_lookup',
      fields: ['username', 'implementerGroupId', 'status'],
    })
    .catch(() => { /* already exists */ });

  // ── alert_events (may be absent) ─────────────────────────────────────
  await createIfMissing(context, 'alert_events', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    alarmName: { type: DataTypes.TEXT, allowNull: false },
    state: { type: DataTypes.TEXT, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    metric: { type: DataTypes.TEXT, allowNull: false },
    source: { type: DataTypes.TEXT, allowNull: false },
    triggeredAt: { type: DataTypes.DATE, allowNull: false },
    rawPayload: { type: DataTypes.JSONB, allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false },
  });
  await context
    .addIndex('alert_events', {
      name: 'alert_events_triggered_at',
      fields: ['triggeredAt'],
    })
    .catch(() => { /* already exists */ });
};

// ── Down ────────────────────────────────────────────────────────────────────
// Reversing this migration would remove columns that 001 owns — intentional
// no-op. Rollback requires a database snapshot restore.
export const down: MigrationFn<QueryInterface> = async () => {
  // no-op
};
