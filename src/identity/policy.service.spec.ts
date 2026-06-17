import { BadRequestException } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import { PolicyService } from './policy.service';
import { AccessPolicy } from './access-policy.entity';
import { DEFAULT_POLICY_MATRIX, PERMISSIONS, ROLES } from '../auth/auth.constants';

describe('PolicyService', () => {
  let service: PolicyService;
  let accessPolicyModel: {
    count: jest.Mock;
    bulkCreate: jest.Mock;
    findAll: jest.Mock;
    upsert: jest.Mock;
  };

  beforeEach(async () => {
    accessPolicyModel = {
      count: jest.fn().mockResolvedValue(1), // non-zero so seedIfEmpty skips
      bulkCreate: jest.fn().mockResolvedValue([]),
      findAll: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PolicyService,
        { provide: getModelToken(AccessPolicy), useValue: accessPolicyModel },
      ],
    }).compile();

    service = module.get(PolicyService);
  });

  describe('onModuleInit', () => {
    it('seeds defaults and ensures admin full access on startup', async () => {
      accessPolicyModel.count.mockResolvedValue(0);

      await service.onModuleInit();

      expect(accessPolicyModel.bulkCreate).toHaveBeenCalledWith(
        ROLES.map((role) => ({
          role,
          permissions: DEFAULT_POLICY_MATRIX[role],
        })),
      );
      expect(accessPolicyModel.upsert).toHaveBeenCalledWith({
        role: 'Admin',
        permissions: expect.arrayContaining(PERMISSIONS),
      });
    });

    it('does not seed when rows already exist', async () => {
      accessPolicyModel.count.mockResolvedValue(5);

      await service.onModuleInit();

      expect(accessPolicyModel.bulkCreate).not.toHaveBeenCalled();
      // ensureAdminFullAccess always runs
      expect(accessPolicyModel.upsert).toHaveBeenCalledWith({
        role: 'Admin',
        permissions: expect.arrayContaining(PERMISSIONS),
      });
    });

    it('swallows errors during init (table may not exist on first boot)', async () => {
      accessPolicyModel.count.mockRejectedValue(new Error('table not found'));
      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });

  describe('getPermissionsForRoles', () => {
    it('returns empty set for empty roles array', async () => {
      const result = await service.getPermissionsForRoles([]);
      expect(result).toEqual(new Set());
      expect(accessPolicyModel.findAll).not.toHaveBeenCalled();
    });

    it('returns the full PERMISSIONS set for the Admin role without querying DB', async () => {
      const result = await service.getPermissionsForRoles(['Admin']);
      expect(result).toEqual(new Set(PERMISSIONS));
      expect(accessPolicyModel.findAll).not.toHaveBeenCalled();
    });

    it('queries the DB and returns a union of permissions for given roles', async () => {
      accessPolicyModel.findAll.mockResolvedValue([
        { role: 'Employee', permissions: ['change.view', 'change.create'] },
        { role: 'Manager', permissions: ['change.view', 'change.approve'] },
      ]);

      const result = await service.getPermissionsForRoles(['Employee', 'Manager']);
      expect(result).toEqual(new Set(['change.view', 'change.create', 'change.approve']));
    });

    it('returns empty set when roles have no policies in DB', async () => {
      accessPolicyModel.findAll.mockResolvedValue([]);
      const result = await service.getPermissionsForRoles(['UnknownRole']);
      expect(result).toEqual(new Set());
    });
  });

  describe('getMatrix', () => {
    it('seeds if empty then returns mapped policy rows', async () => {
      accessPolicyModel.count.mockResolvedValue(1);
      accessPolicyModel.findAll.mockResolvedValue([
        { role: 'Employee', permissions: ['change.view'] },
        { role: 'Admin', permissions: PERMISSIONS },
      ]);

      const result = await service.getMatrix();
      expect(result).toEqual([
        { role: 'Employee', permissions: ['change.view'] },
        { role: 'Admin', permissions: PERMISSIONS },
      ]);
      expect(accessPolicyModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ order: [['role', 'ASC']] }),
      );
    });
  });

  describe('updateMatrix', () => {
    it('upserts valid policies and returns the updated matrix', async () => {
      const policies = [{ role: ROLES[0], permissions: [PERMISSIONS[0]] }];
      accessPolicyModel.findAll.mockResolvedValue(
        policies.map((p) => ({ role: p.role, permissions: p.permissions })),
      );

      const result = await service.updateMatrix(policies);
      expect(accessPolicyModel.upsert).toHaveBeenCalledWith({
        role: policies[0].role,
        permissions: policies[0].permissions,
      });
      expect(result).toEqual(
        policies.map((p) => ({ role: p.role, permissions: p.permissions })),
      );
    });

    it('throws BadRequestException for an unknown role', async () => {
      await expect(
        service.updateMatrix([{ role: 'Hacker', permissions: [] }]),
      ).rejects.toThrow(BadRequestException);
      expect(accessPolicyModel.upsert).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for an unknown permission', async () => {
      await expect(
        service.updateMatrix([{ role: ROLES[0], permissions: ['not.a.real.permission'] }]),
      ).rejects.toThrow(BadRequestException);
      expect(accessPolicyModel.upsert).not.toHaveBeenCalled();
    });

    it('throws on the first invalid policy and short-circuits remaining upserts', async () => {
      const policies = [
        { role: 'BadRole', permissions: [] },
        { role: ROLES[0], permissions: [PERMISSIONS[0]] },
      ];
      await expect(service.updateMatrix(policies)).rejects.toThrow(BadRequestException);
      expect(accessPolicyModel.upsert).not.toHaveBeenCalled();
    });
  });
});
