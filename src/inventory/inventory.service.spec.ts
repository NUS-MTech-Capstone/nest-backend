import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { AssetStatus, VirtualMachine } from './vm.entity';

const makeVm = (overrides: Record<string, unknown> = {}) => {
  const vm: Record<string, unknown> = {
    id: 'vm-1',
    hostname: 'web-01',
    ipAddress: '10.0.0.1',
    assetStatus: AssetStatus.Active,
    osVersion: 'RHEL 9',
    sshPort: 22,
    tags: [],
    save: jest.fn(),
    ...overrides,
  };
  (vm['save'] as jest.Mock).mockResolvedValue(vm);
  return vm as VirtualMachine & { save: jest.Mock };
};

describe('InventoryService', () => {
  let service: InventoryService;
  let virtualMachineModel: {
    findAll: jest.Mock;
    findByPk: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    destroy: jest.Mock;
  };

  beforeEach(async () => {
    virtualMachineModel = {
      findAll: jest.fn(),
      findByPk: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      destroy: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        {
          provide: getModelToken(VirtualMachine),
          useValue: virtualMachineModel,
        },
      ],
    }).compile();

    service = module.get(InventoryService);
  });

  it('findAll returns VMs ordered by hostname', async () => {
    const vms = [makeVm()];
    virtualMachineModel.findAll.mockResolvedValue(vms);

    await expect(service.findAll()).resolves.toBe(vms);
    expect(virtualMachineModel.findAll).toHaveBeenCalledWith({
      order: [['hostname', 'ASC']],
    });
  });

  it('findOne returns a VM by id', async () => {
    const vm = makeVm();
    virtualMachineModel.findByPk.mockResolvedValue(vm);

    await expect(service.findOne('vm-1')).resolves.toBe(vm);
  });

  it('findByHostname returns a VM by hostname', async () => {
    const vm = makeVm();
    virtualMachineModel.findOne.mockResolvedValue(vm);

    await expect(service.findByHostname('web-01')).resolves.toBe(vm);
  });

  it('findByIdOrHostname looks up by hostname without querying UUID pk', async () => {
    const vm = makeVm({ hostname: 'host-dev-1' });
    virtualMachineModel.findOne.mockResolvedValue(vm);

    await expect(service.findByIdOrHostname('host-dev-1')).resolves.toBe(vm);
    expect(virtualMachineModel.findByPk).not.toHaveBeenCalled();
    expect(virtualMachineModel.findOne).toHaveBeenCalledWith({
      where: { hostname: 'host-dev-1' },
      plain: true,
    });
  });

  it('findByIdOrHostname prefers UUID lookup when hostId is a UUID', async () => {
    const vm = makeVm({
      id: '35ff0d89-72ca-4f9a-be26-6f297515127b',
      hostname: 'host-dev-1',
    });
    virtualMachineModel.findByPk.mockResolvedValue(vm);

    await expect(
      service.findByIdOrHostname('35ff0d89-72ca-4f9a-be26-6f297515127b'),
    ).resolves.toBe(vm);
    expect(virtualMachineModel.findByPk).toHaveBeenCalledWith(
      '35ff0d89-72ca-4f9a-be26-6f297515127b',
      { plain: true },
    );
    expect(virtualMachineModel.findOne).not.toHaveBeenCalled();
  });

  it('findByIdOrHostname returns null when neither UUID nor hostname matches', async () => {
    virtualMachineModel.findByPk.mockResolvedValue(null);
    virtualMachineModel.findOne.mockResolvedValue(null);

    await expect(service.findByIdOrHostname('missing-host')).resolves.toBeNull();
    expect(virtualMachineModel.findByPk).not.toHaveBeenCalled();
    expect(virtualMachineModel.findOne).toHaveBeenCalledWith({
      where: { hostname: 'missing-host' },
      plain: true,
    });
  });

  it('create persists a new VM with defaults', async () => {
    const created = makeVm();
    virtualMachineModel.create.mockResolvedValue(created);

    await expect(
      service.create({
        hostname: 'web-01',
        ipAddress: '10.0.0.1',
        osVersion: 'RHEL 9',
      }),
    ).resolves.toBe(created);

    expect(virtualMachineModel.create).toHaveBeenCalledWith({
      hostname: 'web-01',
      ipAddress: '10.0.0.1',
      assetStatus: AssetStatus.Active,
      osVersion: 'RHEL 9',
      sshPort: 22,
    });
  });

  it('update returns undefined when VM is missing', async () => {
    virtualMachineModel.findByPk.mockResolvedValue(null);

    await expect(
      service.update('missing', { hostname: 'new-name' }),
    ).resolves.toBeUndefined();
  });

  it('update saves changed fields', async () => {
    const vm = makeVm();
    virtualMachineModel.findByPk.mockResolvedValue(vm);

    await expect(
      service.update('vm-1', { ipAddress: '10.0.0.2', sshPort: 2222 }),
    ).resolves.toBe(vm);

    expect(vm.ipAddress).toBe('10.0.0.2');
    expect(vm.sshPort).toBe(2222);
    expect(vm.save).toHaveBeenCalled();
  });

  it('sync creates, updates, and counts unchanged records', async () => {
    const existing = makeVm({ hostname: 'db-01', ipAddress: '10.0.0.2' });
    virtualMachineModel.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(
        makeVm({
          hostname: 'cache-01',
          ipAddress: '10.0.0.4',
          osVersion: 'RHEL 9',
        }),
      );
    virtualMachineModel.create.mockResolvedValue(makeVm({ hostname: 'web-01' }));

    const result = await service.sync([
      {
        hostname: 'web-01',
        ipAddress: '10.0.0.1',
        osVersion: 'RHEL 9',
      },
      {
        hostname: 'db-01',
        ipAddress: '10.0.0.3',
        osVersion: 'RHEL 9',
      },
      {
        hostname: 'cache-01',
        ipAddress: '10.0.0.4',
        osVersion: 'RHEL 9',
      },
    ]);

    expect(result).toEqual({ created: 1, updated: 1, unchanged: 1 });
    expect(virtualMachineModel.create).toHaveBeenCalledTimes(1);
    expect(existing.save).toHaveBeenCalled();
  });

  it('setTags normalizes and deduplicates tags', async () => {
    const vm = makeVm();
    virtualMachineModel.findByPk.mockResolvedValue(vm);

    await expect(
      service.setTags('vm-1', [' prod ', 'prod', 'web', '']),
    ).resolves.toBe(vm);

    expect(vm.tags).toEqual(['prod', 'web']);
    expect(vm.save).toHaveBeenCalled();
  });

  it('setTags returns undefined when VM is missing', async () => {
    virtualMachineModel.findByPk.mockResolvedValue(null);

    await expect(service.setTags('missing', ['a'])).resolves.toBeUndefined();
  });

  it('remove returns true when a VM is deleted', async () => {
    virtualMachineModel.destroy.mockResolvedValue(1);

    await expect(service.remove('vm-1')).resolves.toBe(true);
  });

  it('remove returns false when no VM is deleted', async () => {
    virtualMachineModel.destroy.mockResolvedValue(0);

    await expect(service.remove('missing')).resolves.toBe(false);
  });
});
