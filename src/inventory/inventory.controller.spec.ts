import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

describe('InventoryController', () => {
  let controller: InventoryController;
  let inventoryService: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    inventoryService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [{ provide: InventoryService, useValue: inventoryService }],
    }).compile();

    controller = module.get(InventoryController);
  });

  it('findAll returns all virtual machines', () => {
    const vms = [{ id: 'vm-1' }];
    inventoryService.findAll.mockReturnValue(vms);

    expect(controller.findAll()).toBe(vms);
  });

  it('findOne returns a virtual machine', async () => {
    const vm = { id: 'vm-1', name: 'web-01' };
    inventoryService.findOne.mockResolvedValue(vm);

    await expect(controller.findOne('vm-1')).resolves.toBe(vm);
  });

  it('findOne throws when virtual machine is missing', async () => {
    inventoryService.findOne.mockResolvedValue(null);

    await expect(controller.findOne('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('remove deletes a virtual machine', async () => {
    inventoryService.remove.mockResolvedValue(true);

    await expect(controller.remove('vm-1')).resolves.toEqual({ deleted: true });
  });

  it('remove throws when virtual machine is missing', async () => {
    inventoryService.remove.mockResolvedValue(false);

    await expect(controller.remove('missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});
