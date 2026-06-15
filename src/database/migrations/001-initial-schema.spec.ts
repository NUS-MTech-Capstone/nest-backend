import { DEFAULT_POLICY_MATRIX, ROLES } from '../../auth/auth.constants';
import { up } from './001-initial-schema';

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
    ]);
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
          permissions: JSON.stringify(DEFAULT_POLICY_MATRIX[role]),
        }),
      ),
    );
  });
});
