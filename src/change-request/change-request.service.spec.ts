import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import { ChangeRequestService } from './change-request.service';
import { ChangeRequest, ChangeRequestStatus } from './change-request.entity';
import { VirtualMachine } from '../inventory/vm.entity';
import { ImplementerGroupService } from '../implementer-group/implementer-group.service';
import type { AuthUser } from '../auth/auth.types';

const user: AuthUser = {
  sub: 'u1',
  username: 'alice',
  name: 'Alice',
  email: 'alice@example.com',
  roles: ['Employee'],
};

const makeCr = (overrides: Record<string, unknown> = {}): any => {
  const cr: any = {
    id: 'cr-1',
    title: 'Deploy patch',
    description: 'Apply security patches',
    requester: 'Alice',
    approvalRoute: 'Normal',
    status: ChangeRequestStatus.Pending,
    comments: '',
    activities: [],
    vmIds: [],
    allowedRoles: [],
    implementerGroupIds: [],
    history: [],
    scheduledDate: undefined,
    save: jest.fn(),
    ...overrides,
  };
  cr.toJSON = () => {
    const { save, toJSON, ...rest } = cr;
    return rest;
  };
  cr.save.mockResolvedValue(cr);
  return cr;
};

describe('ChangeRequestService', () => {
  let service: ChangeRequestService;
  let changeRequestModel: { findAll: jest.Mock; findByPk: jest.Mock; create: jest.Mock };
  let virtualMachineModel: { findAll: jest.Mock };
  let implementerGroupService: { findByIds: jest.Mock };

  beforeEach(async () => {
    changeRequestModel = {
      findAll: jest.fn(),
      findByPk: jest.fn(),
      create: jest.fn(),
    };
    virtualMachineModel = { findAll: jest.fn().mockResolvedValue([]) };
    implementerGroupService = { findByIds: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChangeRequestService,
        { provide: getModelToken(ChangeRequest), useValue: changeRequestModel },
        { provide: getModelToken(VirtualMachine), useValue: virtualMachineModel },
        { provide: ImplementerGroupService, useValue: implementerGroupService },
      ],
    }).compile();

    service = module.get(ChangeRequestService);
  });

  describe('findAll', () => {
    it('returns all change requests ordered by createdAt DESC', async () => {
      const requests = [makeCr(), makeCr({ id: 'cr-2' })];
      changeRequestModel.findAll.mockResolvedValue(requests);

      await expect(service.findAll()).resolves.toBe(requests);
      expect(changeRequestModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ order: [['createdAt', 'DESC']] }),
      );
    });
  });

  describe('findAccessible', () => {
    it('returns approved CRs visible to the caller role', async () => {
      const cr = makeCr({ status: ChangeRequestStatus.Approved, allowedRoles: ['Employee'] });
      changeRequestModel.findAll.mockResolvedValue([cr]);

      const result = await service.findAccessible(['Employee']);
      expect(result).toHaveLength(1);
    });

    it('hides CRs whose allowedRoles do not match the caller', async () => {
      const cr = makeCr({ status: ChangeRequestStatus.Approved, allowedRoles: ['Manager'] });
      changeRequestModel.findAll.mockResolvedValue([cr]);

      const result = await service.findAccessible(['Employee']);
      expect(result).toHaveLength(0);
    });

    it('Admin sees all approved CRs regardless of allowedRoles', async () => {
      const cr = makeCr({ status: ChangeRequestStatus.Approved, allowedRoles: ['Manager'] });
      changeRequestModel.findAll.mockResolvedValue([cr]);

      const result = await service.findAccessible(['Admin']);
      expect(result).toHaveLength(1);
    });

    it('CR with no allowedRoles is visible to every role', async () => {
      const cr = makeCr({ status: ChangeRequestStatus.Approved, allowedRoles: [] });
      changeRequestModel.findAll.mockResolvedValue([cr]);

      const result = await service.findAccessible(['Employee']);
      expect(result).toHaveLength(1);
    });

    it('resolves VMs and implementer group osUsers onto each result', async () => {
      const vm = { id: 'vm-1', hostname: 'web01' };
      const group = { id: 'grp-1', osUsers: ['osadm1'] };
      const cr = makeCr({
        status: ChangeRequestStatus.Approved,
        allowedRoles: [],
        vmIds: ['vm-1'],
        implementerGroupIds: ['grp-1'],
      });
      changeRequestModel.findAll.mockResolvedValue([cr]);
      virtualMachineModel.findAll.mockResolvedValue([vm]);
      implementerGroupService.findByIds.mockResolvedValue([group]);

      const [result] = await service.findAccessible(['Employee']);
      expect(result.vms).toEqual([vm]);
      expect(result.osUsers).toEqual(['osadm1']);
    });

    it('skips VM query when no vmIds are present', async () => {
      const cr = makeCr({ status: ChangeRequestStatus.Approved, vmIds: [], implementerGroupIds: [] });
      changeRequestModel.findAll.mockResolvedValue([cr]);

      await service.findAccessible(['Employee']);
      expect(virtualMachineModel.findAll).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('returns a change request by primary key', async () => {
      const cr = makeCr();
      changeRequestModel.findByPk.mockResolvedValue(cr);
      await expect(service.findOne('cr-1')).resolves.toBe(cr);
    });

    it('returns null when the CR does not exist', async () => {
      changeRequestModel.findByPk.mockResolvedValue(null);
      await expect(service.findOne('missing')).resolves.toBeNull();
    });
  });

  describe('create', () => {
    const dto = { title: 'Deploy patch', description: 'Patch', approvalRoute: 'Normal' };

    it('creates a Pending CR with requester taken from user.name', async () => {
      const created = makeCr();
      changeRequestModel.create.mockResolvedValue(created);

      await expect(service.create(dto, user)).resolves.toBe(created);
      expect(changeRequestModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ requester: 'Alice', status: ChangeRequestStatus.Pending }),
      );
    });

    it('falls back to email when user.name is absent', async () => {
      changeRequestModel.create.mockResolvedValue(makeCr());
      await service.create(dto, { ...user, name: undefined });
      expect(changeRequestModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ requester: 'alice@example.com' }),
      );
    });

    it('falls back to username when name and email are absent', async () => {
      changeRequestModel.create.mockResolvedValue(makeCr());
      await service.create(dto, { ...user, name: undefined, email: undefined });
      expect(changeRequestModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ requester: 'alice' }),
      );
    });

    it('stores a valid future scheduledDate', async () => {
      const future = new Date(Date.now() + 86_400_000).toISOString();
      changeRequestModel.create.mockResolvedValue(makeCr());
      await service.create({ ...dto, scheduledDate: future }, user);
      expect(changeRequestModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ scheduledDate: expect.any(Date) }),
      );
    });

    it('throws UnprocessableEntityException for a past scheduledDate', async () => {
      const past = new Date(Date.now() - 120_000).toISOString();
      await expect(service.create({ ...dto, scheduledDate: past }, user)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('throws UnprocessableEntityException for an invalid scheduledDate string', async () => {
      await expect(
        service.create({ ...dto, scheduledDate: 'not-a-date' }, user),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('seeds an initial Created history entry', async () => {
      changeRequestModel.create.mockResolvedValue(makeCr());
      await service.create(dto, user);
      const [call] = changeRequestModel.create.mock.calls;
      expect(call[0].history).toHaveLength(1);
      expect(call[0].history[0].action).toBe('Created');
    });
  });

  describe('update', () => {
    it('mutates allowed fields and appends a Modified history entry', async () => {
      const cr = makeCr();
      changeRequestModel.findByPk.mockResolvedValue(cr);

      const result = await service.update('cr-1', { title: 'New title', comments: 'Updated note' });
      expect(cr.title).toBe('New title');
      expect(cr.history).toHaveLength(1);
      expect(cr.history[0].action).toBe('Modified');
      expect(cr.save).toHaveBeenCalled();
      expect(result).toBe(cr);
    });

    it('returns undefined when the CR is not found', async () => {
      changeRequestModel.findByPk.mockResolvedValue(null);
      await expect(service.update('missing', {})).resolves.toBeUndefined();
    });

    it('throws BadRequestException when the CR is Approved', async () => {
      const cr = makeCr({ status: ChangeRequestStatus.Approved });
      changeRequestModel.findByPk.mockResolvedValue(cr);
      await expect(service.update('cr-1', { title: 'X' })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when the CR is Rejected', async () => {
      const cr = makeCr({ status: ChangeRequestStatus.Rejected });
      changeRequestModel.findByPk.mockResolvedValue(cr);
      await expect(service.update('cr-1', {})).rejects.toThrow(BadRequestException);
    });

    it('rejects a past scheduledDate during update', async () => {
      const cr = makeCr();
      changeRequestModel.findByPk.mockResolvedValue(cr);
      const past = new Date(Date.now() - 120_000).toISOString();
      await expect(service.update('cr-1', { scheduledDate: past })).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  describe('approve', () => {
    it('sets status to Approved and records approver name', async () => {
      const cr = makeCr();
      changeRequestModel.findByPk.mockResolvedValue(cr);

      await service.approve('cr-1', user);
      expect(cr.status).toBe(ChangeRequestStatus.Approved);
      expect(cr.approver).toBe('Alice');
      expect(cr.history).toHaveLength(1);
      expect(cr.history[0].action).toBe('Approved');
      expect(cr.save).toHaveBeenCalled();
    });

    it('returns undefined when the CR is not found', async () => {
      changeRequestModel.findByPk.mockResolvedValue(null);
      await expect(service.approve('missing', user)).resolves.toBeUndefined();
    });

    it('throws BadRequestException when the CR is already Approved', async () => {
      const cr = makeCr({ status: ChangeRequestStatus.Approved });
      changeRequestModel.findByPk.mockResolvedValue(cr);
      await expect(service.approve('cr-1', user)).rejects.toThrow(BadRequestException);
    });
  });

  describe('reject', () => {
    it('sets status to Rejected and records approver name', async () => {
      const cr = makeCr();
      changeRequestModel.findByPk.mockResolvedValue(cr);

      await service.reject('cr-1', user);
      expect(cr.status).toBe(ChangeRequestStatus.Rejected);
      expect(cr.approver).toBe('Alice');
      expect(cr.history).toHaveLength(1);
      expect(cr.history[0].action).toBe('Rejected');
    });

    it('returns undefined when the CR is not found', async () => {
      changeRequestModel.findByPk.mockResolvedValue(null);
      await expect(service.reject('missing', user)).resolves.toBeUndefined();
    });

    it('throws BadRequestException when the CR is already Rejected', async () => {
      const cr = makeCr({ status: ChangeRequestStatus.Rejected });
      changeRequestModel.findByPk.mockResolvedValue(cr);
      await expect(service.reject('cr-1', user)).rejects.toThrow(BadRequestException);
    });
  });
});
