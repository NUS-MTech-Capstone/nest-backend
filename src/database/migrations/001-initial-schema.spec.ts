import { DEFAULT_POLICY_MATRIX, ROLES } from '../../auth/auth.constants';
import { up } from './001-initial-schema';

function tableColumns(
  createTable: jest.Mock,
  tableName: string,
): string[] {
  const call = createTable.mock.calls.find(([name]) => name === tableName);
  expect(call).toBeDefined();
  return Object.keys(call![1]);
}

describe('initial database migration', () => {
  it('creates the current tables, membership constraint, and policy seed', async () => {
    const context = {
      createTable: jest.fn().mockResolvedValue(undefined),
      addConstraint: jest.fn().mockResolvedValue(undefined),
      addIndex: jest.fn().mockResolvedValue(undefined),
      bulkInsert: jest.fn().mockResolvedValue(undefined),
    };

    await up({ context } as never);

    expect(context.createTable.mock.calls.map(([name]) => name)).toEqual([
      'virtual_machines',
      'implementer_groups',
      'change_requests',
      'inventory_change_requests',
      'access_policies',
      'implementerGroupMembers',
      'implementerGroupMembershipRequests',
      'access_sessions',
      'alert_events',
    ]);

    expect(tableColumns(context.createTable, 'virtual_machines')).toEqual(
      expect.arrayContaining(['tags']),
    );
    expect(tableColumns(context.createTable, 'change_requests')).toEqual(
      expect.arrayContaining(['scheduledDate']),
    );
    expect(tableColumns(context.createTable, 'alert_events')).toEqual(
      expect.not.arrayContaining(['updatedAt']),
    );

    expect(context.addIndex).toHaveBeenCalledWith(
      'implementerGroupMembershipRequests',
      expect.objectContaining({
        name: 'membership_requests_pending_lookup',
        fields: ['username', 'implementerGroupId', 'status'],
      }),
    );
    expect(context.addIndex).toHaveBeenCalledWith(
      'access_sessions',
      expect.objectContaining({
        name: 'access_sessions_active_host',
        fields: ['status', 'hostId'],
      }),
    );
    expect(context.addIndex).toHaveBeenCalledWith(
      'access_sessions',
      expect.objectContaining({
        name: 'access_sessions_created_by_started',
        fields: ['createdBy', 'startedAt'],
      }),
    );
    expect(context.addIndex).toHaveBeenCalledWith(
      'alert_events',
      expect.objectContaining({
        name: 'alert_events_triggered_at',
        fields: ['triggeredAt'],
      }),
    );
    expect(context.addConstraint).toHaveBeenCalledWith(
      'implementerGroupMembers',
      expect.objectContaining({
        type: 'unique',
        fields: ['username', 'implementerGroupId'],
      }),
    );
    expect(context.bulkInsert).toHaveBeenCalledWith(
      'access_policies',
      ROLES.map((role) =>
        expect.objectContaining({
          role,
          permissions: DEFAULT_POLICY_MATRIX[role],
        }),
      ),
    );
  });
});
