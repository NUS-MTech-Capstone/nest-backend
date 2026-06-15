import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import {
  DEFAULT_POLICY_MATRIX,
  PERMISSIONS,
  ROLES,
} from '../auth/auth.constants';
import { AccessPolicy } from './access-policy.entity';

export interface PolicyRow {
  role: string;
  permissions: string[];
}

@Injectable()
export class PolicyService implements OnModuleInit {
  private logger = new Logger('PolicyService');

  constructor(
    @InjectModel(AccessPolicy)
    private accessPolicyModel: typeof AccessPolicy,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.seedIfEmpty();
      await this.ensureAdminFullAccess();
    } catch (error) {
      // Table may not exist yet on first boot; retries lazily on first read.
      this.logger.warn(`Policy seeding deferred: ${error}`);
    }
  }

  /** Always grant Admin every known permission, regardless of what is stored. */
  private async ensureAdminFullAccess(): Promise<void> {
    await this.accessPolicyModel.upsert({
      role: 'Admin',
      permissions: [...PERMISSIONS],
    });
    this.logger.log('Admin role verified: full permission set applied');
  }

  private async seedIfEmpty(): Promise<void> {
    const count = await this.accessPolicyModel.count();
    if (count > 0) {
      return;
    }
    await this.accessPolicyModel.bulkCreate(
      ROLES.map((role) => ({
        role,
        permissions: DEFAULT_POLICY_MATRIX[role],
      })),
    );
    this.logger.log('Seeded default access policy matrix');
  }

  async getMatrix(): Promise<PolicyRow[]> {
    await this.seedIfEmpty();
    const rows = await this.accessPolicyModel.findAll({
      order: [['role', 'ASC']],
    });
    return rows.map((row) => ({
      role: row.role,
      permissions: row.permissions,
    }));
  }

  async updateMatrix(policies: PolicyRow[]): Promise<PolicyRow[]> {
    for (const policy of policies) {
      if (!ROLES.includes(policy.role as (typeof ROLES)[number])) {
        throw new BadRequestException(`Unknown role: ${policy.role}`);
      }
      const invalid = policy.permissions.filter(
        (permission) =>
          !PERMISSIONS.includes(permission as (typeof PERMISSIONS)[number]),
      );
      if (invalid.length > 0) {
        throw new BadRequestException(
          `Unknown permissions: ${invalid.join(', ')}`,
        );
      }
    }

    for (const policy of policies) {
      await this.accessPolicyModel.upsert({
        role: policy.role,
        permissions: policy.permissions,
      });
    }

    return this.getMatrix();
  }

  async getPermissionsForRoles(roles: string[]): Promise<Set<string>> {
    if (!roles || roles.length === 0) {
      return new Set();
    }
    const rows = await this.accessPolicyModel.findAll({
      where: { role: roles },
    });
    const permissions = new Set<string>();
    for (const row of rows) {
      for (const permission of row.permissions) {
        permissions.add(permission);
      }
    }
    return permissions;
  }
}
