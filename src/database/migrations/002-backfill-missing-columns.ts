/**
 * Comprehensive schema sync for databases provisioned before the canonical
 * 001-initial-schema was finalised.
 *
 * Strategy
 * --------
 * • addIfMissing  – adds a column to an existing table only when it is absent.
 * • backfillJsonb – sets NULL to '[]' after adding a JSONB NOT-NULL column so
 *   existing rows satisfy application-layer expectations.
 * • createIfMissing – creates an entire table only when it does not yet exist.
 *   (Used for tables that may have been introduced after initial deployment.)
 *
 * All operations are idempotent; running this migration on a database that was
 * created from the current 001 is a safe no-op.
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
  if (!desc) return; // table doesn't exist — skip silently
  if (column in desc) return; // already there
  await context.addColumn(table, column, definition);
}

/** After addIfMissing for a NOT-NULL JSONB array column, ensure existing rows
 *  have '[]' rather than NULL so application code never sees null. */
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

/** Creates a table only when it is not already present in the database. */
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
  await addIfMissing(context, 'change_requests', 'implementationStartAt', {
    type: DataTypes.DATE,
    allowNull: true,
  });
  await addIfMissing(context, 'change_requests', 'implementationEndAt', {
    type: DataTypes.DATE,
    allowNull: true,
  });

  // ── implementerGroupMembers (whole table may be absent) ───────────────
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
  // Unique constraint — addConstraint is idempotent by name in PostgreSQL
  await context
    .addConstraint('implementerGroupMembers', {
      name: 'implementer_group_members_user_group_unique',
      type: 'unique',
      fields: ['username', 'implementerGroupId'],
    })
    .catch(() => {
      /* constraint already exists */
    });

  // ── implementerGroupMembershipRequests (whole table may be absent) ────
  // PostgreSQL: create the ENUM type only when it does not already exist.
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
    .catch(() => {
      /* index already exists */
    });

  // ── alert_events (whole table may be absent) ──────────────────────────
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
    .catch(() => {
      /* index already exists */
    });
};

// ── Down ────────────────────────────────────────────────────────────────────
// This migration adds columns and tables to bring an older DB into sync with
// 001. Reversing it would remove columns that 001 considers canonical, leaving
// the schema in an inconsistent state. Down is intentionally a no-op; rolling
// back requires restoring a database snapshot.
export const down: MigrationFn<QueryInterface> = async () => {
  // no-op
};
