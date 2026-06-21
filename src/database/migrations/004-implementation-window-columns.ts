/**
 * 004 — add required implementation window columns to change_requests.
 *
 * 003 was already recorded in SequelizeMeta before implementationStartAt /
 * implementationEndAt were added to its source, so existing databases still
 * have scheduledDate (or neither column on very old schemas).
 */
import { DataTypes, QueryInterface } from 'sequelize';
import type { MigrationFn } from 'umzug';

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

async function backfillImplementationWindow(context: QueryInterface): Promise<void> {
  const desc = await context.describeTable('change_requests').catch(() => undefined);
  if (!desc) return;

  const hasScheduledDate = 'scheduledDate' in desc;

  if (hasScheduledDate) {
    await context.sequelize.query(`
      UPDATE "change_requests"
      SET
        "implementationStartAt" = COALESCE(
          "implementationStartAt",
          "scheduledDate",
          "createdAt"
        ),
        "implementationEndAt" = COALESCE(
          "implementationEndAt",
          "scheduledDate" + INTERVAL '4 hours',
          "createdAt" + INTERVAL '1 day'
        )
      WHERE "implementationStartAt" IS NULL OR "implementationEndAt" IS NULL
    `);
  } else {
    await context.sequelize.query(`
      UPDATE "change_requests"
      SET
        "implementationStartAt" = COALESCE("implementationStartAt", "createdAt"),
        "implementationEndAt" = COALESCE(
          "implementationEndAt",
          "createdAt" + INTERVAL '1 day'
        )
      WHERE "implementationStartAt" IS NULL OR "implementationEndAt" IS NULL
    `);
  }
}

async function enforceNotNull(
  context: QueryInterface,
  column: 'implementationStartAt' | 'implementationEndAt',
): Promise<void> {
  await context.changeColumn('change_requests', column, {
    type: DataTypes.DATE,
    allowNull: false,
  });
}

export const up: MigrationFn<QueryInterface> = async ({ context }) => {
  await addIfMissing(context, 'change_requests', 'implementationStartAt', {
    type: DataTypes.DATE,
    allowNull: true,
  });
  await addIfMissing(context, 'change_requests', 'implementationEndAt', {
    type: DataTypes.DATE,
    allowNull: true,
  });

  await backfillImplementationWindow(context);
  await enforceNotNull(context, 'implementationStartAt');
  await enforceNotNull(context, 'implementationEndAt');
};

export const down: MigrationFn<QueryInterface> = async () => {
  // no-op — rollback requires a database snapshot restore
};
