import { DevUser } from './auth.types';

export const ROLES = [
  'Employee',
  'TechnicalStaff',
  'Manager',
  'SecurityAnalyst',
  'Auditor',
  'Admin',
] as const;

export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'access.view',
  'access.launch',
  'access.stop',
  'access.watch',
  'change.view',
  'change.create',
  'change.update',
  'change.approve',
  'inventory.view',
  'inventory.request',
  'inventory.approve',
  'inventory.delete',
  'identity.users.manage',
  'identity.policies.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const EMPLOYEE_PERMISSIONS: Permission[] = [
  'access.view',
  'change.view',
  'change.create',
  'change.update',
  'inventory.view',
];

export const DEFAULT_POLICY_MATRIX: Record<Role, Permission[]> = {
  Employee: [...EMPLOYEE_PERMISSIONS],
  TechnicalStaff: [
    ...EMPLOYEE_PERMISSIONS,
    'access.launch',
    'inventory.request',
  ],
  Manager: [...EMPLOYEE_PERMISSIONS, 'change.approve', 'inventory.approve'],
  SecurityAnalyst: [...EMPLOYEE_PERMISSIONS, 'access.stop', 'access.watch'],
  Auditor: ['access.view', 'change.view', 'inventory.view'],
  Admin: [...PERMISSIONS],
};

export const DEV_USERS: DevUser[] = [
  {
    username: 'employee.dev',
    name: 'Evan Employee',
    email: 'employee@dendenmushi.local',
    roles: ['Employee'],
  },
  {
    username: 'tech.dev',
    name: 'Tara Tech',
    email: 'tech@dendenmushi.local',
    roles: ['TechnicalStaff', 'Employee'],
  },
  {
    username: 'manager.dev',
    name: 'Mona Manager',
    email: 'manager@dendenmushi.local',
    roles: ['Manager', 'Employee'],
  },
  {
    username: 'analyst.dev',
    name: 'Sasha Analyst',
    email: 'analyst@dendenmushi.local',
    roles: ['SecurityAnalyst', 'Employee'],
  },
  {
    username: 'auditor.dev',
    name: 'Aldo Auditor',
    email: 'auditor@dendenmushi.local',
    roles: ['Auditor'],
  },
  {
    username: 'admin.dev',
    name: 'Kei Yam',
    email: 'admin@dendenmushi.local',
    roles: ['Admin'],
  },
];
