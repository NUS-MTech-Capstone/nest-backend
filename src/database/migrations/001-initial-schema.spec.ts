import { DEFAULT_POLICY_MATRIX, ROLES } from '../../auth/auth.constants';
import { up, down } from './001-initial-schema';

function tableColumns(
  createTable: jest.Mock,
  tableName: string,
): string[] {
  const call = createTable.mock.calls.find(([name]) => name === tableName);
  expect(call).toBeDefined();
  return Object.keys(call![1]);
}

describe('initial database migration', () => {
  describe('up', () => {
    it('creates all tables in FK-safe order with correct columns and seeds access_policies', async () => {
      const context = {
        createTable: jest.fn().mockResolvedValue(undefined),
        addConstraint: jest.fn().mockResolvedValue(undefined),
        addIndex: jest.fn().mockResolvedValue(undefined),
        bulkInsert: jest.fn().mockResolvedValue(undefined),
      };

      await up({ context } as never);

      // Tables created in the correct order
      expect(context.createTable.mock.calls.map(([name]) => name)).toEqual([
        'virtual_machines',
        'implementer_groups',
        'change_requests',
        'inventory_change_requests',
        'access_policies',
        'implementerGroupMembers',
        'implementerGroupMembershipRequests',
        'alert_events',
      ]);

      // Spot-check columns
      expect(tableColumns(context.createTable, 'virtual_machines')).toEqual(
        expect.arrayContaining(['tags']),
      );
      expect(tableColumns(context.createTable, 'change_requests')).toEqual(
        expect.arrayContaining([
          'implementationStartAt',
          'implementationEndAt',
          'allowedRoles',
          'implementerGroupIds',
        ]),
      );
      // alert_events has no updatedAt
      expect(tableColumns(context.createTable, 'alert_events')).toEqual(
        expect.not.arrayContaining(['updatedAt']),
      );

      // Indexes
      expect(context.addIndex).toHaveBeenCalledWith(
        'implementerGroupMembershipRequests',
        expect.objectContaining({
          name: 'membership_requests_pending_lookup',
          fields: ['username', 'implementerGroupId', 'status'],
        }),
      );
      expect(context.addIndex).toHaveBeenCalledWith(
        'alert_events',
        expect.objectContaining({
          name: 'alert_events_triggered_at',
          fields: ['triggeredAt'],
        }),
      );

      // Unique constraint on implementerGroupMembers
      expect(context.addConstraint).toHaveBeenCalledWith(
        'implementerGroupMembers',
        expect.objectContaining({
          type: 'unique',
          fields: ['username', 'implementerGroupId'],
        }),
      );

      // access_policies seed — permissions must be JSON strings (not raw arrays)
      // because QueryInterface.bulkInsert bypasses model-layer JSONB coercion.
      expect(context.bulkInsert).toHaveBeenCalledWith(
        'access_policies',
        ROLES.map((role) =>
          expect.objectContaining({
            role,
            permissions: JSON.stringify(DEFAULT_POLICY_MATRIX[role]),
          }),
        ),
      );
    });
  });

  describe('down', () => {
    it('drops all tables (with CASCADE) and cleans up ENUM types', async () => {
      const queryMock = jest.fn().mockResolvedValue(undefined);
      const context = {
        dropTable: jest.fn().mockResolvedValue(undefined),
        sequelize: { query: queryMock },
      };

      await down({ context } as never);

      // All Nest-owned tables must be dropped
      const droppedTables = context.dropTable.mock.calls.map(([name]) => name);
      expect(droppedTables).toEqual(
        expect.arrayContaining([
          'alert_events',
          'implementerGroupMembershipRequests',
          'implementerGroupMembers',
          'access_policies',
          'inventory_change_requests',
          'change_requests',
          'implementer_groups',
          'virtual_machines',
        ]),
      );

      // Every drop must use CASCADE
      for (const call of context.dropTable.mock.calls) {
        expect(call[1]).toEqual({ cascade: true });
      }

      // ENUM types must be dropped to allow a clean re-run of `up`
      const dropEnumCalls: string[] = queryMock.mock.calls.map(([sql]) => sql as string);
      expect(dropEnumCalls.some((sql) => sql.includes('enum_virtual_machines_assetStatus'))).toBe(true);
      expect(dropEnumCalls.some((sql) => sql.includes('enum_change_requests_status'))).toBe(true);
    });
  });
});
