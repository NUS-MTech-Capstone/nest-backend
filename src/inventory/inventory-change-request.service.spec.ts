import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import { InventoryChangeRequestService } from './inventory-change-request.service';
import {
  InventoryChangeAction,
  InventoryChangeRequest,
  InventoryChangeStatus,
} from './inventory-change-request.entity';
import { InventoryService } from './inventory.service';
import { AssetStatus } from './vm.entity';
import type { AuthUser } from '../auth/auth.types';

const user: AuthUser = {
  sub: 'u1',
  username: 'alice',
  name: 'Alice',
  email: 'alice@example.com',
  roles: ['Admin'],
};

const makeRequest = (overrides: Record<string, unknown> = {}): any => {
  const req: any = {
    id: 'icr-1',
    action: InventoryChangeAction.Add,
    status: InventoryChangeStatus.Pending,
    requester: 'Alice',
    hostname: 'web01',
    ipAddress: '10.0.0.1',
    assetStatus: AssetStatus.Active,
    osVersion: 'Ubuntu 22.04',
    sshPort: 22,
    comments: '',
    history: [],
    save: jest.fn(),
    ...overrides,
  };
  req.save.mockResolvedValue(req);
  return req;
};

describe('InventoryChangeRequestService', () => {
  let service: InventoryChangeRequestService;
  let model: { findAll: jest.Mock; findByPk: jest.Mock; create: jest.Mock; findOne: jest.Mock };
  let inventoryService: {
    findOne: jest.Mock;
    findByHostname: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };

  beforeEach(async () => {
    model = {
      findAll: jest.fn(),
      findByPk: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
    };
    inventoryService = {
      findOne: jest.fn(),
      findByHostname: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryChangeRequestService,
        { provide: getModelToken(InventoryChangeRequest), useValue: model },
        { provide: InventoryService, useValue: inventoryService },
      ],
    }).compile();

    service = module.get(InventoryChangeRequestService);
  });

  describe('create — Add action', () => {
    const addDto = {
      action: InventoryChangeAction.Add,
      hostname: 'web01',
      ipAddress: '10.0.0.1',
      osVersion: 'Ubuntu 22.04',
    };

    it('creates a Pending Add request', async () => {
      inventoryService.findByHostname.mockResolvedValue(null);
      model.findOne.mockResolvedValue(null);
      const created = makeRequest();
      model.create.mockResolvedValue(created);

      await expect(service.create(addDto, user)).resolves.toBe(created);
      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: InventoryChangeStatus.Pending,
          requester: 'Alice',
          action: InventoryChangeAction.Add,
        }),
      );
    });

    it('throws when hostname already exists in inventory', async () => {
      inventoryService.findByHostname.mockResolvedValue({ id: 'vm-1', hostname: 'web01' });

      await expect(service.create(addDto, user)).rejects.toThrow(BadRequestException);
    });

    it('throws when a pending Add request already exists for the same hostname', async () => {
      inventoryService.findByHostname.mockResolvedValue(null);
      model.findOne.mockResolvedValue(makeRequest());

      await expect(service.create(addDto, user)).rejects.toThrow(BadRequestException);
    });
  });

  describe('create — Update action', () => {
    const updateDto = {
      action: InventoryChangeAction.Update,
      targetVmId: 'vm-1',
      hostname: 'web01',
      ipAddress: '10.0.0.2',
      osVersion: 'Ubuntu 22.04',
    };

    it('creates a Pending Update request', async () => {
      inventoryService.findOne.mockResolvedValue({ id: 'vm-1' });
      model.findOne.mockResolvedValue(null);
      const created = makeRequest({ action: InventoryChangeAction.Update });
      model.create.mockResolvedValue(created);

      await expect(service.create(updateDto, user)).resolves.toBe(created);
      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: InventoryChangeAction.Update }),
      );
    });

    it('throws when targetVmId is missing for an Update request', async () => {
      await expect(
        service.create({ ...updateDto, targetVmId: undefined }, user),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when the target VM does not exist', async () => {
      inventoryService.findOne.mockResolvedValue(null);
      await expect(service.create(updateDto, user)).rejects.toThrow(NotFoundException);
    });

    it('throws when a pending Update request already exists for the VM', async () => {
      inventoryService.findOne.mockResolvedValue({ id: 'vm-1' });
      model.findOne.mockResolvedValue(makeRequest({ action: InventoryChangeAction.Update }));

      await expect(service.create(updateDto, user)).rejects.toThrow(BadRequestException);
    });
  });

  describe('approve', () => {
    it('approves an Add request — creates VM in inventory', async () => {
      const req = makeRequest({ action: InventoryChangeAction.Add });
      model.findByPk.mockResolvedValue(req);
      inventoryService.findByHostname.mockResolvedValue(null);
      inventoryService.create.mockResolvedValue({});

      await service.approve('icr-1', user);
      expect(inventoryService.create).toHaveBeenCalledWith(
        expect.objectContaining({ hostname: 'web01' }),
      );
      expect(req.status).toBe(InventoryChangeStatus.Approved);
      expect(req.approver).toBe('Alice');
      expect(req.save).toHaveBeenCalled();
    });

    it('approves an Update request — updates the existing VM', async () => {
      const req = makeRequest({ action: InventoryChangeAction.Update, targetVmId: 'vm-1' });
      model.findByPk.mockResolvedValue(req);
      inventoryService.update.mockResolvedValue({ id: 'vm-1' });

      await service.approve('icr-1', user);
      expect(inventoryService.update).toHaveBeenCalledWith('vm-1', expect.any(Object));
      expect(req.status).toBe(InventoryChangeStatus.Approved);
    });

    it('returns undefined when the request is not found', async () => {
      model.findByPk.mockResolvedValue(null);
      await expect(service.approve('missing', user)).resolves.toBeUndefined();
    });

    it('throws BadRequestException when the request is already Approved', async () => {
      const req = makeRequest({ status: InventoryChangeStatus.Approved });
      model.findByPk.mockResolvedValue(req);
      await expect(service.approve('icr-1', user)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when Add hostname already exists at approval time', async () => {
      const req = makeRequest({ action: InventoryChangeAction.Add });
      model.findByPk.mockResolvedValue(req);
      inventoryService.findByHostname.mockResolvedValue({ id: 'vm-existing' });

      await expect(service.approve('icr-1', user)).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when the target VM is gone at approval time', async () => {
      const req = makeRequest({ action: InventoryChangeAction.Update, targetVmId: 'vm-1' });
      model.findByPk.mockResolvedValue(req);
      inventoryService.update.mockResolvedValue(null);

      await expect(service.approve('icr-1', user)).rejects.toThrow(NotFoundException);
    });
  });

  describe('reject', () => {
    it('rejects a pending request and records the approver', async () => {
      const req = makeRequest();
      model.findByPk.mockResolvedValue(req);

      await service.reject('icr-1', user);
      expect(req.status).toBe(InventoryChangeStatus.Rejected);
      expect(req.approver).toBe('Alice');
      expect(req.history).toHaveLength(1);
      expect(req.history[0].action).toBe('Rejected');
      expect(req.save).toHaveBeenCalled();
    });

    it('returns undefined when the request is not found', async () => {
      model.findByPk.mockResolvedValue(null);
      await expect(service.reject('missing', user)).resolves.toBeUndefined();
    });

    it('throws BadRequestException when the request is already Rejected', async () => {
      const req = makeRequest({ status: InventoryChangeStatus.Rejected });
      model.findByPk.mockResolvedValue(req);
      await expect(service.reject('icr-1', user)).rejects.toThrow(BadRequestException);
    });
  });
});
