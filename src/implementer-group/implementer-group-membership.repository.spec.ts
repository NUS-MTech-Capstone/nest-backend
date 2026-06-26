import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import { ImplementerGroupMember } from './implementer-group-member.entity';
import {
  ImplementerGroupMembershipRequest,
  MembershipRequestStatus,
} from './implementer-group-membership-request.entity';
import { ImplementerGroupMembershipRepository } from './implementer-group-membership.repository';

describe('ImplementerGroupMembershipRepository', () => {
  let repository: ImplementerGroupMembershipRepository;
  let requestModel: {
    findAll: jest.Mock;
    findByPk: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
  };
  let memberModel: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    destroy: jest.Mock;
  };

  beforeEach(async () => {
    requestModel = {
      findAll: jest.fn(),
      findByPk: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
    };
    memberModel = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      destroy: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImplementerGroupMembershipRepository,
        {
          provide: getModelToken(ImplementerGroupMembershipRequest),
          useValue: requestModel,
        },
        {
          provide: getModelToken(ImplementerGroupMember),
          useValue: memberModel,
        },
      ],
    }).compile();

    repository = module.get(ImplementerGroupMembershipRepository);
  });

  it('findAllRequests filters by status when provided', async () => {
    const requests = [{ id: 'req-1' }];
    requestModel.findAll.mockResolvedValue(requests);

    await expect(
      repository.findAllRequests(MembershipRequestStatus.Pending),
    ).resolves.toBe(requests);
    expect(requestModel.findAll).toHaveBeenCalledWith({
      where: { status: MembershipRequestStatus.Pending },
      order: [['createdAt', 'DESC']],
    });
  });

  it('findAllRequests omits where clause when status is undefined', async () => {
    requestModel.findAll.mockResolvedValue([]);

    await repository.findAllRequests();

    expect(requestModel.findAll).toHaveBeenCalledWith({
      where: undefined,
      order: [['createdAt', 'DESC']],
    });
  });

  it('findPendingRequest looks up pending membership by user and group', async () => {
    const pending = { id: 'req-1' };
    requestModel.findOne.mockResolvedValue(pending);

    await expect(
      repository.findPendingRequest('alice', 'group-1'),
    ).resolves.toBe(pending);
    expect(requestModel.findOne).toHaveBeenCalledWith({
      where: {
        username: 'alice',
        implementerGroupId: 'group-1',
        status: MembershipRequestStatus.Pending,
      },
    });
  });

  it('createRequest delegates to the request model', async () => {
    const created = { id: 'req-1', username: 'alice' };
    requestModel.create.mockResolvedValue(created);

    await expect(
      repository.createRequest({ username: 'alice', implementerGroupId: 'group-1' }),
    ).resolves.toBe(created);
  });

  it('saveRequest persists request changes', async () => {
    const request = { save: jest.fn().mockResolvedValue({ id: 'req-1' }) };

    await expect(repository.saveRequest(request as never)).resolves.toEqual({
      id: 'req-1',
    });
    expect(request.save).toHaveBeenCalled();
  });

  it('findMembersByGroupId orders members by username', async () => {
    memberModel.findAll.mockResolvedValue([]);

    await repository.findMembersByGroupId('group-1');

    expect(memberModel.findAll).toHaveBeenCalledWith({
      where: { implementerGroupId: 'group-1' },
      order: [['username', 'ASC']],
    });
  });

  it('removeMember deletes the membership row', async () => {
    memberModel.destroy.mockResolvedValue(1);

    await expect(repository.removeMember('alice', 'group-1')).resolves.toBe(1);
    expect(memberModel.destroy).toHaveBeenCalledWith({
      where: { username: 'alice', implementerGroupId: 'group-1' },
    });
  });

  it('findMembershipsForUser returns memberships for a username', async () => {
    const memberships = [{ id: 'member-1' }];
    memberModel.findAll.mockResolvedValue(memberships);

    await expect(repository.findMembershipsForUser('alice')).resolves.toBe(
      memberships,
    );
    expect(memberModel.findAll).toHaveBeenCalledWith({
      where: { username: 'alice' },
      order: [['createdAt', 'DESC']],
    });
  });
});
