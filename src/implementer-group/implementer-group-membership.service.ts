import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { VirtualMachine } from '../inventory/vm.entity';
import { CreateMembershipRequestDto } from './dto/create-membership-request.dto';
import { ImplementerGroup } from './implementer-group.entity';
import { ImplementerGroupService } from './implementer-group.service';
import { ImplementerGroupMembershipRepository } from './implementer-group-membership.repository';
import {
  ImplementerGroupMembershipRequest,
  MembershipRequestStatus,
} from './implementer-group-membership-request.entity';
import { ImplementerGroupMember } from './implementer-group-member.entity';

export interface AccessibleAssetsResult {
  implementerGroups: ImplementerGroup[];
  osUsers: string[];
  vms: VirtualMachine[];
}

@Injectable()
export class ImplementerGroupMembershipService {
  constructor(
    private repository: ImplementerGroupMembershipRepository,
    private implementerGroupService: ImplementerGroupService,
    @InjectModel(VirtualMachine)
    private vmModel: typeof VirtualMachine,
  ) {}

  findAllRequests(
    status?: MembershipRequestStatus,
  ): Promise<ImplementerGroupMembershipRequest[]> {
    return this.repository.findAllRequests(status);
  }

  findMembers(implementerGroupId: string): Promise<ImplementerGroupMember[]> {
    return this.repository.findMembersByGroupId(implementerGroupId);
  }

  async createRequest(
    dto: CreateMembershipRequestDto,
    requester: string,
  ): Promise<ImplementerGroupMembershipRequest> {
    const group = await this.implementerGroupService.findOne(
      dto.implementerGroupId,
    );
    if (!group) {
      throw new NotFoundException(
        `Implementer group ${dto.implementerGroupId} not found`,
      );
    }

    const existingMember = await this.repository.findMember(
      dto.username,
      dto.implementerGroupId,
    );
    if (existingMember) {
      throw new BadRequestException(
        `User "${dto.username}" is already a member of this group`,
      );
    }

    const pending = await this.repository.findPendingRequest(
      dto.username,
      dto.implementerGroupId,
    );
    if (pending) {
      throw new BadRequestException(
        'A pending membership request already exists for this user and group',
      );
    }

    return this.repository.createRequest({
      username: dto.username,
      implementerGroupId: dto.implementerGroupId,
      requester,
      comments: dto.comments ?? '',
      status: MembershipRequestStatus.Pending,
      history: [
        {
          when: new Date().toISOString(),
          actor: requester,
          action: 'Created',
          note: dto.comments || 'Membership request submitted.',
        },
      ],
    });
  }

  async approve(
    id: string,
    approver: string,
  ): Promise<ImplementerGroupMembershipRequest> {
    const request = await this.repository.findRequestById(id);
    if (!request) {
      throw new NotFoundException(`Membership request ${id} not found`);
    }
    if (request.status !== MembershipRequestStatus.Pending) {
      throw new BadRequestException('Only pending requests can be approved');
    }

    const existingMember = await this.repository.findMember(
      request.username,
      request.implementerGroupId,
    );
    if (!existingMember) {
      await this.repository.createMember(
        request.username,
        request.implementerGroupId,
      );
    }

    request.status = MembershipRequestStatus.Approved;
    request.approver = approver;
    request.history = [
      ...request.history,
      {
        when: new Date().toISOString(),
        actor: approver,
        action: 'Approved',
        note: request.comments || 'Membership approved.',
      },
    ];
    return this.repository.saveRequest(request);
  }

  async reject(
    id: string,
    approver: string,
  ): Promise<ImplementerGroupMembershipRequest> {
    const request = await this.repository.findRequestById(id);
    if (!request) {
      throw new NotFoundException(`Membership request ${id} not found`);
    }
    if (request.status !== MembershipRequestStatus.Pending) {
      throw new BadRequestException('Only pending requests can be rejected');
    }

    request.status = MembershipRequestStatus.Rejected;
    request.approver = approver;
    request.history = [
      ...request.history,
      {
        when: new Date().toISOString(),
        actor: approver,
        action: 'Rejected',
        note: request.comments || 'Membership rejected.',
      },
    ];
    return this.repository.saveRequest(request);
  }

  async removeMember(
    implementerGroupId: string,
    username: string,
  ): Promise<void> {
    const removed = await this.repository.removeMember(
      username,
      implementerGroupId,
    );
    if (!removed) {
      throw new NotFoundException(
        `Member "${username}" not found in group ${implementerGroupId}`,
      );
    }
  }

  async findAccessibleAssets(
    username: string,
    roles: string[],
  ): Promise<AccessibleAssetsResult> {
    if (roles.includes('Admin')) {
      const [implementerGroups, vms] = await Promise.all([
        this.implementerGroupService.findAll(),
        this.vmModel.findAll({ order: [['hostname', 'ASC']] }),
      ]);
      const osUsers = [
        ...new Set(implementerGroups.flatMap((group) => group.osUsers ?? [])),
      ];
      return { implementerGroups, osUsers, vms };
    }

    const memberships = await this.repository.findMembershipsForUser(username);
    if (!memberships.length) {
      return { implementerGroups: [], osUsers: [], vms: [] };
    }

    const groupResults = await Promise.all(
      memberships.map((membership) =>
        this.implementerGroupService.findOne(membership.implementerGroupId),
      ),
    );
    const implementerGroups = groupResults.filter(
      (group): group is ImplementerGroup => group !== null,
    );

    const vmIds = [
      ...new Set(implementerGroups.flatMap((group) => group.vmIds ?? [])),
    ];
    const osUsers = [
      ...new Set(implementerGroups.flatMap((group) => group.osUsers ?? [])),
    ];
    const vms = vmIds.length
      ? await this.vmModel.findAll({
          where: { id: { [Op.in]: vmIds } },
          order: [['hostname', 'ASC']],
        })
      : [];

    return { implementerGroups, osUsers, vms };
  }
}
