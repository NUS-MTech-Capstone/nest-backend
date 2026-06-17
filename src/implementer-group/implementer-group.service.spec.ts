import { BadRequestException } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import { ImplementerGroupService } from './implementer-group.service';
import { ImplementerGroup } from './implementer-group.entity';

const makeGroup = (overrides: Record<string, unknown> = {}) => {
  const group: Record<string, unknown> = {
    id: 'group-1',
    name: 'Linux Ops',
    description: 'Linux team',
    osUsers: ['deploy'],
    vmIds: ['vm-1'],
    save: jest.fn(),
    ...overrides,
  };
  (group['save'] as jest.Mock).mockResolvedValue(group);
  return group as ImplementerGroup & { save: jest.Mock };
};

describe('ImplementerGroupService', () => {
  let service: ImplementerGroupService;
  let implementerGroupModel: {
    findAll: jest.Mock;
    findByPk: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    destroy: jest.Mock;
  };

  beforeEach(async () => {
    implementerGroupModel = {
      findAll: jest.fn(),
      findByPk: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      destroy: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImplementerGroupService,
        {
          provide: getModelToken(ImplementerGroup),
          useValue: implementerGroupModel,
        },
      ],
    }).compile();

    service = module.get(ImplementerGroupService);
  });

  it('findAll returns groups ordered by name', async () => {
    const groups = [makeGroup()];
    implementerGroupModel.findAll.mockResolvedValue(groups);

    await expect(service.findAll()).resolves.toBe(groups);
    expect(implementerGroupModel.findAll).toHaveBeenCalledWith({
      order: [['name', 'ASC']],
    });
  });

  it('findByIds returns empty array for empty input', async () => {
    await expect(service.findByIds([])).resolves.toEqual([]);
    expect(implementerGroupModel.findAll).not.toHaveBeenCalled();
  });

  it('findByIds loads groups by id list', async () => {
    const groups = [makeGroup()];
    implementerGroupModel.findAll.mockResolvedValue(groups);

    await expect(service.findByIds(['group-1'])).resolves.toBe(groups);
    expect(implementerGroupModel.findAll).toHaveBeenCalledWith({
      where: { id: ['group-1'] },
    });
  });

  it('create rejects duplicate group names', async () => {
    implementerGroupModel.findOne.mockResolvedValue(makeGroup());

    await expect(
      service.create({
        name: 'Linux Ops',
        osUsers: ['deploy'],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('create persists a new group', async () => {
    const created = makeGroup();
    implementerGroupModel.findOne.mockResolvedValue(null);
    implementerGroupModel.create.mockResolvedValue(created);

    await expect(
      service.create({
        name: 'Linux Ops',
        description: 'Linux team',
        osUsers: ['deploy'],
        vmIds: ['vm-1'],
      }),
    ).resolves.toBe(created);

    expect(implementerGroupModel.create).toHaveBeenCalledWith({
      name: 'Linux Ops',
      description: 'Linux team',
      osUsers: ['deploy'],
      vmIds: ['vm-1'],
    });
  });

  it('update returns undefined when group is missing', async () => {
    implementerGroupModel.findByPk.mockResolvedValue(null);

    await expect(
      service.update('missing', { description: 'updated' }),
    ).resolves.toBeUndefined();
  });

  it('update rejects renaming to an existing group name', async () => {
    const group = makeGroup();
    implementerGroupModel.findByPk.mockResolvedValue(group);
    implementerGroupModel.findOne.mockResolvedValue(makeGroup({ id: 'group-2' }));

    await expect(
      service.update('group-1', { name: 'DB Ops' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('update saves changed fields', async () => {
    const group = makeGroup();
    implementerGroupModel.findByPk.mockResolvedValue(group);

    await expect(
      service.update('group-1', {
        description: 'Updated',
        osUsers: ['root'],
        vmIds: ['vm-2'],
      }),
    ).resolves.toBe(group);

    expect(group.description).toBe('Updated');
    expect(group.osUsers).toEqual(['root']);
    expect(group.vmIds).toEqual(['vm-2']);
    expect(group.save).toHaveBeenCalled();
  });

  it('remove returns true when a group is deleted', async () => {
    implementerGroupModel.destroy.mockResolvedValue(1);

    await expect(service.remove('group-1')).resolves.toBe(true);
  });

  it('remove returns false when no group is deleted', async () => {
    implementerGroupModel.destroy.mockResolvedValue(0);

    await expect(service.remove('missing')).resolves.toBe(false);
  });
});
