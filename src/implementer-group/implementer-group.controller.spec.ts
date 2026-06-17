import { Test, TestingModule } from '@nestjs/testing';
import { ImplementerGroupController } from './implementer-group.controller';
import { ImplementerGroupService } from './implementer-group.service';
import { ImplementerGroupMembershipService } from './implementer-group-membership.service';
import { MembershipRequestStatus } from './implementer-group-membership-request.entity';
import type { AuthUser } from '../auth/auth.types';

describe('ImplementerGroupController', () => {
  let controller: ImplementerGroupController;
  let membershipService: {
    findAllRequests: jest.Mock;
    createRequest: jest.Mock;
    approve: jest.Mock;
    reject: jest.Mock;
    findMembers: jest.Mock;
    removeMember: jest.Mock;
    findAccessibleAssets: jest.Mock;
  };

  const user: AuthUser = {
    sub: '1',
    username: 'manager',
    name: 'Manager User',
    roles: ['Admin'],
  };

  beforeEach(async () => {
    membershipService = {
      findAllRequests: jest.fn(),
      createRequest: jest.fn(),
      approve: jest.fn(),
      reject: jest.fn(),
      findMembers: jest.fn(),
      removeMember: jest.fn(),
      findAccessibleAssets: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImplementerGroupController],
      providers: [
        {
          provide: ImplementerGroupService,
          useValue: {
            findAll: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: ImplementerGroupMembershipService,
          useValue: membershipService,
        },
      ],
    }).compile();

    controller = module.get(ImplementerGroupController);
  });

  it('findMembershipRequests delegates to membership service', () => {
    const requests = [{ id: 'req-1' }];
    membershipService.findAllRequests.mockReturnValue(requests);

    expect(
      controller.findMembershipRequests(MembershipRequestStatus.Pending),
    ).toBe(requests);
    expect(membershipService.findAllRequests).toHaveBeenCalledWith(
      MembershipRequestStatus.Pending,
    );
  });

  it('createMembershipRequest delegates to membership service', () => {
    const dto = {
      username: 'alice',
      implementerGroupId: 'group-1',
      requester: 'bob',
    };
    const created = { id: 'req-1', ...dto };
    membershipService.createRequest.mockReturnValue(created);

    expect(controller.createMembershipRequest(dto)).toBe(created);
    expect(membershipService.createRequest).toHaveBeenCalledWith(dto);
  });

  it('approveMembershipRequest uses current user name', () => {
    const approved = { id: 'req-1', status: MembershipRequestStatus.Approved };
    membershipService.approve.mockReturnValue(approved);

    expect(controller.approveMembershipRequest('req-1', user)).toBe(approved);
    expect(membershipService.approve).toHaveBeenCalledWith(
      'req-1',
      user.name,
    );
  });

  it('rejectMembershipRequest uses username when name is missing', () => {
    const rejected = { id: 'req-1', status: MembershipRequestStatus.Rejected };
    membershipService.reject.mockReturnValue(rejected);
    const userWithoutName = { ...user, name: undefined };

    expect(controller.rejectMembershipRequest('req-1', userWithoutName)).toBe(
      rejected,
    );
    expect(membershipService.reject).toHaveBeenCalledWith(
      'req-1',
      user.username,
    );
  });

  it('findMembers delegates to membership service', () => {
    const members = [{ username: 'alice' }];
    membershipService.findMembers.mockReturnValue(members);

    expect(controller.findMembers('group-1')).toBe(members);
    expect(membershipService.findMembers).toHaveBeenCalledWith('group-1');
  });

  it('removeMember delegates to membership service', () => {
    membershipService.removeMember.mockReturnValue(undefined);

    expect(controller.removeMember('group-1', 'alice')).toBeUndefined();
    expect(membershipService.removeMember).toHaveBeenCalledWith(
      'group-1',
      'alice',
    );
  });

  it('findAccessibleVms delegates to membership service', () => {
    const assets = { implementerGroups: [], osUsers: [], vms: [] };
    membershipService.findAccessibleAssets = jest.fn().mockReturnValue(assets);

    expect(controller.findAccessibleVms(user)).toBe(assets);
    expect(membershipService.findAccessibleAssets).toHaveBeenCalledWith(
      user.username,
      user.roles,
    );
  });
});
