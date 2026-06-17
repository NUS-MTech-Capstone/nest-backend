import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { InventoryChangeRequestController } from './inventory-change-request.controller';
import { InventoryChangeRequestService } from './inventory-change-request.service';

describe('InventoryChangeRequestController', () => {
  let controller: InventoryChangeRequestController;
  let inventoryChangeRequestService: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    approve: jest.Mock;
    reject: jest.Mock;
  };

  beforeEach(async () => {
    inventoryChangeRequestService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      approve: jest.fn(),
      reject: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryChangeRequestController],
      providers: [
        {
          provide: InventoryChangeRequestService,
          useValue: inventoryChangeRequestService,
        },
      ],
    }).compile();

    controller = module.get(InventoryChangeRequestController);
  });

  it('findAll returns all inventory change requests', () => {
    const requests = [{ id: 'icr-1' }];
    inventoryChangeRequestService.findAll.mockReturnValue(requests);

    expect(controller.findAll()).toBe(requests);
  });

  it('findOne returns an inventory change request', async () => {
    const request = { id: 'icr-1' };
    inventoryChangeRequestService.findOne.mockResolvedValue(request);

    await expect(controller.findOne('icr-1')).resolves.toBe(request);
  });

  it('findOne throws when request is missing', async () => {
    inventoryChangeRequestService.findOne.mockResolvedValue(null);

    await expect(controller.findOne('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('create delegates to service', () => {
    const dto = { vmId: 'vm-1', action: 'resize' };
    const created = { id: 'icr-1', ...dto };
    inventoryChangeRequestService.create.mockReturnValue(created);

    expect(controller.create(dto as never)).toBe(created);
  });

  it('approve returns approved request', async () => {
    const approved = { id: 'icr-1', status: 'Approved' };
    inventoryChangeRequestService.approve.mockResolvedValue(approved);

    await expect(controller.approve('icr-1')).resolves.toBe(approved);
  });

  it('approve throws when request is missing', async () => {
    inventoryChangeRequestService.approve.mockResolvedValue(null);

    await expect(controller.approve('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('reject returns rejected request', async () => {
    const rejected = { id: 'icr-1', status: 'Rejected' };
    inventoryChangeRequestService.reject.mockResolvedValue(rejected);

    await expect(controller.reject('icr-1')).resolves.toBe(rejected);
  });
});
