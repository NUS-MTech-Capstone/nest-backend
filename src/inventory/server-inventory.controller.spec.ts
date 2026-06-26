import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AssetStatus } from './vm.entity';
import { InventoryService } from './inventory.service';
import { ServerInventoryController } from './server-inventory.controller';

describe('ServerInventoryController', () => {
  let controller: ServerInventoryController;
  let inventoryService: {
    findByIdOrHostname: jest.Mock;
  };

  const vm = {
    id: '35ff0d89-72ca-4f9a-be26-6f297515127b',
    hostname: 'host-dev-1',
    ipAddress: '10.0.10.203',
    sshPort: 22,
    assetStatus: AssetStatus.Active,
  };

  beforeEach(async () => {
    inventoryService = {
      findByIdOrHostname: jest.fn(),
    };

    process.env.SERVER_INVENTORY_STATIC_JSON = JSON.stringify({
      'host-dev-1': {
        address: '10.0.10.203:22',
        username: 'ec2-user',
        connectionType: 'ssh',
        credentialSecretId: 'arn:aws:secretsmanager:secret',
        hostPublicKey: 'ssh-ed25519 AAAATEST',
        automation: {
          serviceName: 'nginx',
          healthUrl: 'http://127.0.0.1/',
          helperPath: '/usr/local/sbin/ddm-ops',
          allowedOperations: ['health_check'],
        },
      },
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServerInventoryController],
      providers: [{ provide: InventoryService, useValue: inventoryService }],
    }).compile();

    controller = module.get(ServerInventoryController);
  });

  afterEach(() => {
    delete process.env.SERVER_INVENTORY_STATIC_JSON;
    delete process.env.SERVER_INVENTORY_DEFAULT_USERNAME;
    delete process.env.SERVER_INVENTORY_DEFAULT_CREDENTIAL_SECRET_ID;
    delete process.env.SERVER_INVENTORY_DEFAULT_HOST_PUBLIC_KEY;
  });

  it('returns STS server inventory for a VM using static SSH metadata', async () => {
    inventoryService.findByIdOrHostname.mockResolvedValue(vm);

    await expect(controller.getServer(vm.id)).resolves.toEqual({
      hostId: 'host-dev-1',
      hostname: 'host-dev-1',
      address: '10.0.10.203:22',
      status: AssetStatus.Active,
      connectionType: 'ssh',
      username: 'ec2-user',
      credentialSecretId: 'arn:aws:secretsmanager:secret',
      hostPublicKey: 'ssh-ed25519 AAAATEST',
      automation: {
        serviceName: 'nginx',
        healthUrl: 'http://127.0.0.1/',
        helperPath: '/usr/local/sbin/ddm-ops',
        allowedOperations: ['health_check'],
      },
    });
    expect(inventoryService.findByIdOrHostname).toHaveBeenCalledWith(vm.id);
  });

  it('resolves static SSH metadata keyed by VM UUID', async () => {
    process.env.SERVER_INVENTORY_STATIC_JSON = JSON.stringify({
      [vm.id]: {
        address: '10.0.10.203:22',
        username: 'ec2-user',
        connectionType: 'ssh',
        credentialSecretId: 'arn:aws:secretsmanager:secret',
        hostPublicKey: 'ssh-ed25519 AAAATEST',
      },
    });
    inventoryService.findByIdOrHostname.mockResolvedValue(vm);

    await expect(controller.getServer(vm.id)).resolves.toEqual(
      expect.objectContaining({
        hostId: 'host-dev-1',
        username: 'ec2-user',
        credentialSecretId: 'arn:aws:secretsmanager:secret',
      }),
    );
  });

  it('falls back to default SSH metadata env vars', async () => {
    delete process.env.SERVER_INVENTORY_STATIC_JSON;
    process.env.SERVER_INVENTORY_DEFAULT_USERNAME = 'ec2-user';
    process.env.SERVER_INVENTORY_DEFAULT_CREDENTIAL_SECRET_ID =
      'secret/default';
    process.env.SERVER_INVENTORY_DEFAULT_HOST_PUBLIC_KEY =
      'ssh-ed25519 AAAADEFAULT';
    inventoryService.findByIdOrHostname.mockResolvedValue(vm);

    await expect(controller.getServer('host-dev-1')).resolves.toEqual(
      expect.objectContaining({
        hostId: 'host-dev-1',
        address: '10.0.10.203:22',
        username: 'ec2-user',
        credentialSecretId: 'secret/default',
        hostPublicKey: 'ssh-ed25519 AAAADEFAULT',
      }),
    );
  });

  it('throws when static inventory JSON is invalid', async () => {
    process.env.SERVER_INVENTORY_STATIC_JSON = '{not-json';
    inventoryService.findByIdOrHostname.mockResolvedValue(vm);

    await expect(controller.getServer('host-dev-1')).rejects.toThrow(
      'SERVER_INVENTORY_STATIC_JSON is invalid JSON',
    );
  });

  it('throws NotFoundException when the VM does not exist', async () => {
    inventoryService.findByIdOrHostname.mockResolvedValue(null);

    await expect(controller.getServer('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws when required SSH metadata is missing', async () => {
    delete process.env.SERVER_INVENTORY_STATIC_JSON;
    inventoryService.findByIdOrHostname.mockResolvedValue(vm);

    await expect(controller.getServer('host-dev-1')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
