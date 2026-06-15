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
  await context.dropTable('implementerGroupMembershipRequests');
  await context.dropTable('implementerGroupMembers');
  await context.dropTable('access_policies');
  await context.dropTable('inventory_change_requests');
  await context.dropTable('change_requests');
  await context.dropTable('implementer_groups');
  await context.dropTable('virtual_machines');
};
