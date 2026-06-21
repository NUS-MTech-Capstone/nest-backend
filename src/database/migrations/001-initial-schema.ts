import { DataTypes, QueryInterface, literal } from 'sequelize';
import type { MigrationFn } from 'umzug';
import { DEFAULT_POLICY_MATRIX, ROLES } from '../../auth/auth.constants';

const timestamps = {
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: literal('CURRENT_TIMESTAMP'),
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: literal('CURRENT_TIMESTAMP'),
  },
};

export const up: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.createTable('virtual_machines', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    hostname: { type: DataTypes.TEXT, allowNull: false, unique: true },
    ipAddress: { type: DataTypes.TEXT, allowNull: false },
    assetStatus: {
      type: DataTypes.ENUM('Active', 'Inactive', 'Maintenance', 'Retired'),
      allowNull: false,
      defaultValue: 'Active',
    },
    osVersion: { type: DataTypes.TEXT, allowNull: false },
    sshPort: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 22 },
    tags: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    ...timestamps,
  });

  await context.createTable('implementer_groups', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    name: { type: DataTypes.TEXT, allowNull: false, unique: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    osUsers: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    vmIds: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    ...timestamps,
  });

  await context.createTable('change_requests', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    title: { type: DataTypes.TEXT, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false },
    requester: { type: DataTypes.TEXT, allowNull: false },
    approvalRoute: { type: DataTypes.TEXT, allowNull: false },
    status: {
      type: DataTypes.ENUM('Pending', 'Approved', 'Rejected'),
      allowNull: false,
      defaultValue: 'Pending',
    },
    approver: { type: DataTypes.TEXT, allowNull: true },
    comments: { type: DataTypes.TEXT, allowNull: true },
    history: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    activities: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    vmIds: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    allowedRoles: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    implementerGroupIds: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    scheduledDate: { type: DataTypes.DATE, allowNull: true },
    ...timestamps,
  });

  await context.createTable('inventory_change_requests', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    action: {
      type: DataTypes.ENUM('Add', 'Update'),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('Pending', 'Approved', 'Rejected'),
      allowNull: false,
      defaultValue: 'Pending',
    },
    requester: { type: DataTypes.TEXT, allowNull: false },
    targetVmId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'virtual_machines', key: 'id' },
      onDelete: 'SET NULL',
    },
    hostname: { type: DataTypes.TEXT, allowNull: false },
    ipAddress: { type: DataTypes.TEXT, allowNull: false },
    assetStatus: {
      type: DataTypes.ENUM('Active', 'Inactive', 'Maintenance', 'Retired'),
      allowNull: false,
      defaultValue: 'Active',
    },
    osVersion: { type: DataTypes.TEXT, allowNull: false },
    sshPort: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 22 },
    comments: { type: DataTypes.TEXT, allowNull: true },
    approver: { type: DataTypes.TEXT, allowNull: true },
    history: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    ...timestamps,
  });

  await context.createTable('access_policies', {
    role: { type: DataTypes.TEXT, primaryKey: true, allowNull: false },
    permissions: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    ...timestamps,
  });

  await context.createTable('implementerGroupMembers', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    username: { type: DataTypes.TEXT, allowNull: false },
    implementerGroupId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'implementer_groups', key: 'id' },
      onDelete: 'CASCADE',
    },
    ...timestamps,
  });
  await context.addConstraint('implementerGroupMembers', {
    name: 'implementer_group_members_user_group_unique',
    type: 'unique',
    fields: ['username', 'implementerGroupId'],
  });

  await context.createTable('implementerGroupMembershipRequests', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
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
  await context.addIndex('implementerGroupMembershipRequests', {
    name: 'membership_requests_pending_lookup',
    fields: ['username', 'implementerGroupId', 'status'],
  });

  await context.createTable('access_sessions', {
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
  await context.addIndex('access_sessions', {
    name: 'access_sessions_active_host',
    fields: ['status', 'hostId'],
  });
  await context.addIndex('access_sessions', {
    name: 'access_sessions_created_by_started',
    fields: ['createdBy', 'startedAt'],
  });

  await context.createTable('alert_events', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    alarmName: { type: DataTypes.TEXT, allowNull: false },
    state: { type: DataTypes.TEXT, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    metric: { type: DataTypes.TEXT, allowNull: false },
    source: { type: DataTypes.TEXT, allowNull: false },
    triggeredAt: { type: DataTypes.DATE, allowNull: false },
    rawPayload: { type: DataTypes.JSONB, allowNull: true },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: literal('CURRENT_TIMESTAMP'),
    },
  });
  await context.addIndex('alert_events', {
    name: 'alert_events_triggered_at',
    fields: ['triggeredAt'],
  });

  // QueryInterface.bulkInsert does not go through Sequelize's model-layer type
  // coercion, so JSONB values must be serialised manually — otherwise pg sends
  // a plain JS array as a PostgreSQL array literal ({...}) which is invalid for
  // a jsonb column and causes "invalid input syntax for type json".
  await context.bulkInsert(
    'access_policies',
    ROLES.map((role) => ({
      role,
      permissions: JSON.stringify(DEFAULT_POLICY_MATRIX[role]),
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  );
};

export const down: MigrationFn<QueryInterface> = async ({ context }) => {
  // Drop tables in reverse FK-dependency order.
  // Use CASCADE so that any residual FK constraints don't block the drop.
  await context.dropTable('alert_events', { cascade: true });
  await context.dropTable('access_sessions', { cascade: true });
  await context.dropTable('implementerGroupMembershipRequests', { cascade: true });
  await context.dropTable('implementerGroupMembers', { cascade: true });
  await context.dropTable('access_policies', { cascade: true });
  await context.dropTable('inventory_change_requests', { cascade: true });
  await context.dropTable('change_requests', { cascade: true });
  await context.dropTable('implementer_groups', { cascade: true });
  await context.dropTable('virtual_machines', { cascade: true });

  // PostgreSQL ENUM types are not dropped with their table — they must be
  // removed explicitly, otherwise a subsequent `up` fails with
  // "type already exists".
  const sequelize = context.sequelize;
  const enumsToDrop = [
    'enum_virtual_machines_assetStatus',
    'enum_change_requests_status',
    'enum_inventory_change_requests_action',
    'enum_inventory_change_requests_status',
    'enum_inventory_change_requests_assetStatus',
    'enum_implementerGroupMembershipRequests_status',
  ];
  for (const enumName of enumsToDrop) {
    await sequelize.query(`DROP TYPE IF EXISTS "${enumName}" CASCADE`);
  }
};
