import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import { VirtualMachine } from '../inventory/vm.entity';
import { ImplementerGroupMembershipService } from './implementer-group-membership.service';
import { ImplementerGroupMembershipRepository } from './implementer-group-membership.repository';
import { ImplementerGroupService } from './implementer-group.service';
import {
  ImplementerGroupMembershipRequest,
  MembershipRequestStatus,
} from './implementer-group-membership-request.entity';

describe('ImplementerGroupMembershipService', () => {
  let service: ImplementerGroupMembershipService;
  let repository: {
    findMember: jest.Mock;
    findPendingRequest: jest.Mock;
    createRequest: jest.Mock;
    findRequestById: jest.Mock;
    createMember: jest.Mock;
    saveRequest: jest.Mock;
    findMembershipsForUser: jest.Mock;
  };
  let implementerGroupService: { findOne: jest.Mock };

  const groupId = 'group-1';
  const dto = {
    username: 'alice',
    implementerGroupId: groupId,
    requester: 'bob',
    comments: 'Please add',
  };

  beforeEach(async () => {
    repository = {
      findMember: jest.fn(),
      findPendingRequest: jest.fn(),
      createRequest: jest.fn(),
      findRequestById: jest.fn(),
      createMember: jest.fn(),
      saveRequest: jest.fn(),
      findMembershipsForUser: jest.fn(),
    };
    implementerGroupService = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImplementerGroupMembershipService,
        {
          provide: ImplementerGroupMembershipRepository,
          useValue: repository,
        },
        {
          provide: ImplementerGroupService,
          useValue: implementerGroupService,
        },
        {
          provide: getModelToken(VirtualMachine),
          useValue: { findAll: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(ImplementerGroupMembershipService);
  });

  describe('createRequest', () => {
    it('creates a pending membership request', async () => {
      const created = {
        id: 'req-1',
        ...dto,
        status: MembershipRequestStatus.Pending,
      };
      implementerGroupService.findOne.mockResolvedValue({ id: groupId });
      repository.findMember.mockResolvedValue(null);
      repository.findPendingRequest.mockResolvedValue(null);
      repository.createRequest.mockResolvedValue(created);

      await expect(service.createRequest(dto)).resolves.toEqual(created);
      expect(repository.createRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          username: dto.username,
          implementerGroupId: groupId,
          status: MembershipRequestStatus.Pending,
        }),
      );
    });

    it('throws when group is not found', async () => {
      implementerGroupService.findOne.mockResolvedValue(null);

      await expect(service.createRequest(dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws when user is already a member', async () => {
      implementerGroupService.findOne.mockResolvedValue({ id: groupId });
      repository.findMember.mockResolvedValue({ username: dto.username });

      await expect(service.createRequest(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws when a pending request already exists', async () => {
      implementerGroupService.findOne.mockResolvedValue({ id: groupId });
      repository.findMember.mockResolvedValue(null);
      repository.findPendingRequest.mockResolvedValue({ id: 'pending-1' });

      await expect(service.createRequest(dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('approve', () => {
    const pendingRequest = {
      id: 'req-1',
      username: 'alice',
      implementerGroupId: groupId,
      status: MembershipRequestStatus.Pending,
      comments: 'Please add',
      history: [],
    } as ImplementerGroupMembershipRequest;

    it('approves a pending request and creates member when needed', async () => {
      const approved = {
        ...pendingRequest,
        status: MembershipRequestStatus.Approved,
        approver: 'manager',
      };
      repository.findRequestById.mockResolvedValue({ ...pendingRequest });
      repository.findMember.mockResolvedValue(null);
      repository.saveRequest.mockResolvedValue(approved);

      await expect(service.approve('req-1', 'manager')).resolves.toEqual(
        approved,
      );
      expect(repository.createMember).toHaveBeenCalledWith('alice', groupId);
      expect(repository.saveRequest).toHaveBeenCalledWith(
        expect.objectContaining({ status: MembershipRequestStatus.Approved }),
      );
    });

    it('throws when request is not found', async () => {
      repository.findRequestById.mockResolvedValue(null);

      await expect(service.approve('missing', 'manager')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws when request is not pending', async () => {
      repository.findRequestById.mockResolvedValue({
        ...pendingRequest,
        status: MembershipRequestStatus.Approved,
      });

      await expect(service.approve('req-1', 'manager')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('reject', () => {
    const pendingRequest = {
      id: 'req-1',
      username: 'alice',
      implementerGroupId: groupId,
      status: MembershipRequestStatus.Pending,
      comments: 'Please add',
      history: [],
    } as ImplementerGroupMembershipRequest;

    it('rejects a pending request', async () => {
      const rejected = {
        ...pendingRequest,
        status: MembershipRequestStatus.Rejected,
        approver: 'manager',
      };
      repository.findRequestById.mockResolvedValue({ ...pendingRequest });
      repository.saveRequest.mockResolvedValue(rejected);

      await expect(service.reject('req-1', 'manager')).resolves.toEqual(
        rejected,
      );
      expect(repository.saveRequest).toHaveBeenCalledWith(
        expect.objectContaining({ status: MembershipRequestStatus.Rejected }),
      );
    });

    it('throws when request is not found', async () => {
      repository.findRequestById.mockResolvedValue(null);

      await expect(service.reject('missing', 'manager')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws when request is not pending', async () => {
      repository.findRequestById.mockResolvedValue({
        ...pendingRequest,
        status: MembershipRequestStatus.Rejected,
      });

      await expect(service.reject('req-1', 'manager')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAccessibleAssets', () => {
    it('returns VMs from groups the user belongs to', async () => {
      const vmModel = {
        findAll: jest
          .fn()
          .mockResolvedValue([{ id: 'vm-1', hostname: 'web01' }]),
      };
      repository.findMembershipsForUser.mockResolvedValue([
        { implementerGroupId: 'group-1' },
      ]);
      implementerGroupService.findOne.mockResolvedValue({
        id: 'group-1',
        name: 'SG_INF',
        osUsers: ['osadm1'],
        vmIds: ['vm-1'],
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ImplementerGroupMembershipService,
          {
            provide: ImplementerGroupMembershipRepository,
            useValue: repository,
          },
          {
            provide: ImplementerGroupService,
            useValue: implementerGroupService,
          },
          {
            provide: getModelToken(VirtualMachine),
            useValue: vmModel,
          },
        ],
      }).compile();

      const accessibleService = module.get(ImplementerGroupMembershipService);

      await expect(
        accessibleService.findAccessibleAssets('alice', ['TechnicalStaff']),
      ).resolves.toEqual({
        implementerGroups: [
          expect.objectContaining({ id: 'group-1', vmIds: ['vm-1'] }),
        ],
        osUsers: ['osadm1'],
        vms: [{ id: 'vm-1', hostname: 'web01' }],
      });
    });
  });
});
