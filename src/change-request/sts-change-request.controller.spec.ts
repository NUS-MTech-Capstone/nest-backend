import { NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import { VirtualMachine } from '../inventory/vm.entity';
import { ChangeRequestStatus } from './change-request.entity';
import { ChangeRequestService } from './change-request.service';
import { StsChangeRequestController } from './sts-change-request.controller';

describe('StsChangeRequestController', () => {
  let controller: StsChangeRequestController;
  let changeRequestService: {
    findOne: jest.Mock;
  };
  let vmModel: {
    findAll: jest.Mock;
  };

  beforeEach(async () => {
    changeRequestService = {
      findOne: jest.fn(),
    };
    vmModel = {
      findAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StsChangeRequestController],
      providers: [
        { provide: ChangeRequestService, useValue: changeRequestService },
        { provide: getModelToken(VirtualMachine), useValue: vmModel },
      ],
    }).compile();

    controller = module.get(StsChangeRequestController);
  });

  it('returns STS change-request metadata with gateway host IDs', async () => {
    changeRequestService.findOne.mockResolvedValue({
      id: 'cr-1',
      status: ChangeRequestStatus.Approved,
      vmIds: ['vm-1', 'vm-2'],
    });
    vmModel.findAll.mockResolvedValue([
      { hostname: 'host-dev-1' },
      { hostname: 'host-dev-2' },
    ]);

    await expect(controller.findOne('cr-1')).resolves.toEqual({
      crId: 'cr-1',
      status: ChangeRequestStatus.Approved,
      hostIds: ['host-dev-1', 'host-dev-2'],
    });
    expect(vmModel.findAll).toHaveBeenCalledWith({
      where: { id: ['vm-1', 'vm-2'] },
    });
  });

  it('throws NotFoundException when the change request does not exist', async () => {
    changeRequestService.findOne.mockResolvedValue(null);

    await expect(controller.findOne('missing')).rejects.toThrow(NotFoundException);
    expect(vmModel.findAll).not.toHaveBeenCalled();
  });

  it('returns an empty hostIds list when the change request has no VMs', async () => {
    changeRequestService.findOne.mockResolvedValue({
      id: 'cr-empty',
      status: ChangeRequestStatus.Approved,
      vmIds: [],
    });

    await expect(controller.findOne('cr-empty')).resolves.toEqual({
      crId: 'cr-empty',
      status: ChangeRequestStatus.Approved,
      hostIds: [],
    });
    expect(vmModel.findAll).not.toHaveBeenCalled();
  });
});
