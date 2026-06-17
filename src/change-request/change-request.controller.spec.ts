import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ChangeRequestController } from './change-request.controller';
import { ChangeRequestService } from './change-request.service';
import type { AuthUser } from '../auth/auth.types';

describe('ChangeRequestController', () => {
  let controller: ChangeRequestController;
  let service: {
    findAll: jest.Mock;
    findAccessible: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    approve: jest.Mock;
    reject: jest.Mock;
  };

  const user: AuthUser = { sub: '1', username: 'alice', name: 'Alice', roles: ['Employee'] };

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findAccessible: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      approve: jest.fn(),
      reject: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChangeRequestController],
      providers: [{ provide: ChangeRequestService, useValue: service }],
    }).compile();

    controller = module.get(ChangeRequestController);
  });

  describe('findAll', () => {
    it('delegates to service and returns all requests', () => {
      const requests = [{ id: 'cr-1' }];
      service.findAll.mockReturnValue(requests);
      expect(controller.findAll()).toBe(requests);
    });
  });

  describe('findAccessible', () => {
    it('calls service with caller roles and returns results', () => {
      const requests = [{ id: 'cr-1' }];
      service.findAccessible.mockReturnValue(requests);
      expect(controller.findAccessible(user)).toBe(requests);
      expect(service.findAccessible).toHaveBeenCalledWith(user.roles);
    });
  });

  describe('findOne', () => {
    it('returns a change request by id', async () => {
      const cr = { id: 'cr-1' };
      service.findOne.mockResolvedValue(cr);
      await expect(controller.findOne('cr-1')).resolves.toBe(cr);
    });

    it('throws NotFoundException when the CR is not found', async () => {
      service.findOne.mockResolvedValue(null);
      await expect(controller.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates a CR passing the authenticated user', () => {
      const dto = { title: 'Deploy', description: 'Patch', approvalRoute: 'Normal' };
      const created = { id: 'cr-1', ...dto };
      service.create.mockReturnValue(created);

      expect(controller.create(dto as never, user)).toBe(created);
      expect(service.create).toHaveBeenCalledWith(dto, user);
    });
  });

  describe('update', () => {
    it('returns the updated CR', async () => {
      const updated = { id: 'cr-1', title: 'Updated' };
      service.update.mockResolvedValue(updated);
      await expect(controller.update('cr-1', { title: 'Updated' } as never)).resolves.toBe(updated);
    });

    it('throws NotFoundException when the CR is not found', async () => {
      service.update.mockResolvedValue(undefined);
      await expect(controller.update('missing', {} as never)).rejects.toThrow(NotFoundException);
    });
  });

  describe('approve', () => {
    it('approves a CR with the authenticated user', async () => {
      const approved = { id: 'cr-1', status: 'Approved' };
      service.approve.mockResolvedValue(approved);
      await expect(controller.approve('cr-1', user)).resolves.toBe(approved);
      expect(service.approve).toHaveBeenCalledWith('cr-1', user);
    });

    it('throws NotFoundException when the CR is not found', async () => {
      service.approve.mockResolvedValue(undefined);
      await expect(controller.approve('missing', user)).rejects.toThrow(NotFoundException);
    });
  });

  describe('reject', () => {
    it('rejects a CR with the authenticated user', async () => {
      const rejected = { id: 'cr-1', status: 'Rejected' };
      service.reject.mockResolvedValue(rejected);
      await expect(controller.reject('cr-1', user)).resolves.toBe(rejected);
      expect(service.reject).toHaveBeenCalledWith('cr-1', user);
    });

    it('throws NotFoundException when the CR is not found', async () => {
      service.reject.mockResolvedValue(undefined);
      await expect(controller.reject('missing', user)).rejects.toThrow(NotFoundException);
    });
  });
});
