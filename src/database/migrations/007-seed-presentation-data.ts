import { QueryInterface } from 'sequelize';
import type { MigrationFn } from 'umzug';

const MARKER_HOSTNAME = 'web-prod-01';

const VM_IDS = {
  webProd01: 'b0000001-0000-4000-8000-000000000001',
  webProd02: 'b0000001-0000-4000-8000-000000000002',
  apiProd01: 'b0000001-0000-4000-8000-000000000003',
  dbProd01: 'b0000001-0000-4000-8000-000000000004',
  cache01: 'b0000001-0000-4000-8000-000000000005',
  bastion01: 'b0000001-0000-4000-8000-000000000006',
} as const;

const GROUP_IDS = {
  platform: 'c0000001-0000-4000-8000-000000000001',
  database: 'c0000001-0000-4000-8000-000000000002',
} as const;

const CR_IDS = {
  patch: 'd0000001-0000-4000-8000-000000000001',
  drill: 'd0000001-0000-4000-8000-000000000002',
  upgrade: 'd0000001-0000-4000-8000-000000000003',
} as const;

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function history(actor: string, action: string, note: string) {
  return JSON.stringify([
    {
      when: new Date().toISOString(),
      actor,
      action,
      note,
    },
  ]);
}

async function seedAlreadyApplied(context: QueryInterface): Promise<boolean> {
  const [rows] = await context.sequelize.query(
    `SELECT id FROM virtual_machines WHERE hostname = :hostname LIMIT 1`,
    { replacements: { hostname: MARKER_HOSTNAME } },
  );
  return Array.isArray(rows) && rows.length > 0;
}

export const up: MigrationFn<QueryInterface> = async ({ context }) => {
  if (await seedAlreadyApplied(context)) {
    return;
  }

  const now = new Date();
  const windowStart = isoDaysFromNow(-1);
  const windowEnd = isoDaysFromNow(7);

  await context.bulkInsert('virtual_machines', [
    {
      id: VM_IDS.webProd01,
      hostname: 'web-prod-01',
      ipAddress: '10.10.1.11',
      assetStatus: 'Active',
      osVersion: 'RHEL 9.4',
      sshPort: 22,
      tags: JSON.stringify(['production', 'web', 'tier-1']),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: VM_IDS.webProd02,
      hostname: 'web-prod-02',
      ipAddress: '10.10.1.12',
      assetStatus: 'Active',
      osVersion: 'RHEL 9.4',
      sshPort: 22,
      tags: JSON.stringify(['production', 'web', 'tier-1']),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: VM_IDS.apiProd01,
      hostname: 'api-prod-01',
      ipAddress: '10.10.2.21',
      assetStatus: 'Active',
      osVersion: 'Amazon Linux 2023',
      sshPort: 22,
      tags: JSON.stringify(['production', 'api']),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: VM_IDS.dbProd01,
      hostname: 'db-prod-01',
      ipAddress: '10.10.3.31',
      assetStatus: 'Active',
      osVersion: 'RHEL 9.4',
      sshPort: 22,
      tags: JSON.stringify(['production', 'database', 'pci']),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: VM_IDS.cache01,
      hostname: 'cache-prod-01',
      ipAddress: '10.10.3.41',
      assetStatus: 'Maintenance',
      osVersion: 'Ubuntu 22.04 LTS',
      sshPort: 22,
      tags: JSON.stringify(['production', 'cache']),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: VM_IDS.bastion01,
      hostname: 'bastion-01',
      ipAddress: '10.10.0.5',
      assetStatus: 'Active',
      osVersion: 'Amazon Linux 2023',
      sshPort: 22,
      tags: JSON.stringify(['shared', 'bastion']),
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await context.bulkInsert('implementer_groups', [
    {
      id: GROUP_IDS.platform,
      name: 'Platform Engineering',
      description: 'Owns web and API production servers.',
      osUsers: JSON.stringify(['deploy-bot', 'ec2-user']),
      vmIds: JSON.stringify([
        VM_IDS.webProd01,
        VM_IDS.webProd02,
        VM_IDS.apiProd01,
        VM_IDS.bastion01,
      ]),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: GROUP_IDS.database,
      name: 'Database Operations',
      description: 'Database and cache tier implementers.',
      osUsers: JSON.stringify(['dba-admin', 'ec2-user']),
      vmIds: JSON.stringify([VM_IDS.dbProd01, VM_IDS.cache01]),
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await context.bulkInsert('implementerGroupMembers', [
    {
      id: 'e0000001-0000-4000-8000-000000000001',
      username: 'tech.dev',
      implementerGroupId: GROUP_IDS.platform,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'e0000001-0000-4000-8000-000000000002',
      username: 'tech.dev',
      implementerGroupId: GROUP_IDS.database,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'e0000001-0000-4000-8000-000000000003',
      username: 'admin.dev',
      implementerGroupId: GROUP_IDS.platform,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await context.bulkInsert('change_requests', [
    {
      id: CR_IDS.patch,
      title: 'Monthly security patching — production web tier',
      description:
        'Apply kernel and OpenSSL updates to production web and API nodes during the approved maintenance window.',
      requester: 'tech.dev',
      approvalRoute: 'Manager approval',
      status: 'Approved',
      approver: 'manager.dev',
      comments: 'Approved for weekend maintenance slot.',
      history: history(
        'manager.dev',
        'Approved',
        'Patch window confirmed with application owners.',
      ),
      activities: JSON.stringify([
        'Apply OS security patches',
        'Reboot if required',
        'Validate health checks',
      ]),
      vmIds: JSON.stringify([VM_IDS.webProd01, VM_IDS.webProd02, VM_IDS.apiProd01]),
      allowedRoles: JSON.stringify(['TechnicalStaff', 'Admin']),
      implementerGroupIds: JSON.stringify([GROUP_IDS.platform]),
      implementationStartAt: windowStart,
      implementationEndAt: windowEnd,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: CR_IDS.drill,
      title: 'Database failover drill',
      description:
        'Simulated failover exercise for the primary PostgreSQL cluster and Redis cache pair.',
      requester: 'analyst.dev',
      approvalRoute: 'Security review',
      status: 'Approved',
      approver: 'manager.dev',
      comments: 'Run during low-traffic hours.',
      history: history(
        'manager.dev',
        'Approved',
        'Failover drill scheduled with DB ops.',
      ),
      activities: JSON.stringify([
        'Trigger controlled failover',
        'Verify replication lag',
        'Restore primary after validation',
      ]),
      vmIds: JSON.stringify([VM_IDS.dbProd01, VM_IDS.cache01]),
      allowedRoles: JSON.stringify([]),
      implementerGroupIds: JSON.stringify([GROUP_IDS.database]),
      implementationStartAt: windowStart,
      implementationEndAt: windowEnd,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: CR_IDS.upgrade,
      title: 'Upgrade bastion host tooling',
      description:
        'Deploy updated session recording agent and rotate host keys on the shared bastion.',
      requester: 'employee.dev',
      approvalRoute: 'Standard change',
      status: 'Pending',
      approver: null,
      comments: 'Awaiting manager sign-off.',
      history: history(
        'employee.dev',
        'Created',
        'Submitted for standard change approval.',
      ),
      activities: JSON.stringify(['Install agent package', 'Rotate SSH host keys']),
      vmIds: JSON.stringify([VM_IDS.bastion01]),
      allowedRoles: JSON.stringify(['TechnicalStaff']),
      implementerGroupIds: JSON.stringify([GROUP_IDS.platform]),
      implementationStartAt: isoDaysFromNow(3),
      implementationEndAt: isoDaysFromNow(5),
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await context.bulkInsert('inventory_change_requests', [
    {
      id: 'f0000001-0000-4000-8000-000000000001',
      action: 'Add',
      status: 'Pending',
      requester: 'tech.dev',
      targetVmId: null,
      hostname: 'analytics-prod-01',
      ipAddress: '10.10.4.51',
      assetStatus: 'Active',
      osVersion: 'RHEL 9.4',
      sshPort: 22,
      comments: 'New analytics node for Q3 reporting workloads.',
      approver: null,
      history: history(
        'tech.dev',
        'Created',
        'Requested new analytics VM in inventory.',
      ),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'f0000001-0000-4000-8000-000000000002',
      action: 'Update',
      status: 'Approved',
      requester: 'manager.dev',
      targetVmId: VM_IDS.cache01,
      hostname: 'cache-prod-01',
      ipAddress: '10.10.3.41',
      assetStatus: 'Active',
      osVersion: 'Ubuntu 24.04 LTS',
      sshPort: 22,
      comments: 'Return cache node to Active after maintenance.',
      approver: 'manager.dev',
      history: history(
        'manager.dev',
        'Approved',
        'Maintenance completed; restore Active status.',
      ),
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await context.bulkInsert('alert_events', [
    {
      id: 'a0000001-0000-4000-8000-000000000001',
      alarmName: 'HighCPU-web-prod-01',
      state: 'ALARM',
      description: 'CPU utilization exceeded 85% for 5 minutes.',
      metric: 'CPUUtilization',
      source: 'AWS/EC2',
      triggeredAt: isoDaysFromNow(-0),
      rawPayload: JSON.stringify({ namespace: 'AWS/EC2', threshold: 85 }),
      createdAt: now,
    },
    {
      id: 'a0000001-0000-4000-8000-000000000002',
      alarmName: 'DiskSpace-db-prod-01',
      state: 'OK',
      description: 'Database volume usage returned below 70%.',
      metric: 'DiskSpaceUtilization',
      source: 'AWS/EC2',
      triggeredAt: isoDaysFromNow(-1),
      rawPayload: JSON.stringify({ namespace: 'AWS/EC2', threshold: 70 }),
      createdAt: now,
    },
    {
      id: 'a0000001-0000-4000-8000-000000000003',
      alarmName: 'SSHSessionCount-bastion-01',
      state: 'ALARM',
      description: 'Unusual number of concurrent SSH sessions detected.',
      metric: 'ActiveSessions',
      source: 'DenDenMushi/Access',
      triggeredAt: isoDaysFromNow(-0),
      rawPayload: JSON.stringify({ host: 'bastion-01', threshold: 10 }),
      createdAt: now,
    },
  ]);
};

export const down: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.bulkDelete('alert_events', {
    id: [
      'a0000001-0000-4000-8000-000000000001',
      'a0000001-0000-4000-8000-000000000002',
      'a0000001-0000-4000-8000-000000000003',
    ],
  });
  await context.bulkDelete('inventory_change_requests', {
    id: [
      'f0000001-0000-4000-8000-000000000001',
      'f0000001-0000-4000-8000-000000000002',
    ],
  });
  await context.bulkDelete('change_requests', {
    id: [CR_IDS.patch, CR_IDS.drill, CR_IDS.upgrade],
  });
  await context.bulkDelete('implementerGroupMembers', {
    id: [
      'e0000001-0000-4000-8000-000000000001',
      'e0000001-0000-4000-8000-000000000002',
      'e0000001-0000-4000-8000-000000000003',
    ],
  });
  await context.bulkDelete('implementer_groups', {
    id: [GROUP_IDS.platform, GROUP_IDS.database],
  });
  await context.bulkDelete('virtual_machines', {
    id: Object.values(VM_IDS),
  });
};
