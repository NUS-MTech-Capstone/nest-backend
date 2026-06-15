import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CreateChangeRequestDto } from './dto/create-change-request.dto';
import { UpdateChangeRequestDto } from './dto/update-change-request.dto';
import {
  ChangeRequest,
  ChangeRequestStatus,
  ApprovalHistoryItem,
} from './change-request.entity';
import { VirtualMachine } from '../inventory/vm.entity';
import { ImplementerGroup } from '../implementer-group/implementer-group.entity';
import { ImplementerGroupService } from '../implementer-group/implementer-group.service';

export type AccessibleChangeRequest = ReturnType<ChangeRequest['toJSON']> & {
  vms: VirtualMachine[];
  implementerGroups: ImplementerGroup[];
  osUsers: string[];
};

@Injectable()
export class ChangeRequestService {
  constructor(
    @InjectModel(ChangeRequest)
    private changeRequestModel: typeof ChangeRequest,
    @InjectModel(VirtualMachine)
    private virtualMachineModel: typeof VirtualMachine,
    private implementerGroupService: ImplementerGroupService,
  ) {}

  findAll(): Promise<ChangeRequest[]> {
    return this.changeRequestModel.findAll({
      order: [['createdAt', 'DESC']],
    });
  }

  /**
   * Approved change requests usable in the Access tab, filtered by the
   * caller's roles. A CR with no allowedRoles is visible to everyone;
   * Admins see everything. VMs are resolved from the inventory.
   */
  async findAccessible(roles: string[]): Promise<AccessibleChangeRequest[]> {
    const approved = await this.changeRequestModel.findAll({
      where: { status: ChangeRequestStatus.Approved },
      order: [['createdAt', 'DESC']],
    });

    const isAdmin = roles.includes('Admin');
    const visible = approved.filter(
      (request) =>
        isAdmin ||
        request.allowedRoles.length === 0 ||
        request.allowedRoles.some((role) => roles.includes(role)),
    );

    const vmIds = [...new Set(visible.flatMap((request) => request.vmIds))];
    const groupIds = [
      ...new Set(visible.flatMap((request) => request.implementerGroupIds)),
    ];

    const [vms, implementerGroups] = await Promise.all([
      vmIds.length
        ? this.virtualMachineModel.findAll({ where: { id: vmIds } })
        : Promise.resolve([]),
      this.implementerGroupService.findByIds(groupIds),
    ]);

    const vmsById = new Map(vms.map((vm) => [vm.id, vm]));
    const groupsById = new Map(
      implementerGroups.map((group) => [group.id, group]),
    );

    return visible.map((request) => {
      const groups = request.implementerGroupIds
        .map((id) => groupsById.get(id))
        .filter((group): group is ImplementerGroup => !!group);
      const osUsers = [...new Set(groups.flatMap((group) => group.osUsers))];
      return {
        ...request.toJSON(),
        vms: request.vmIds
          .map((id) => vmsById.get(id))
          .filter((vm): vm is VirtualMachine => !!vm),
        implementerGroups: groups,
        osUsers,
      };
    });
  }

  findOne(id: string): Promise<ChangeRequest | null> {
    return this.changeRequestModel.findByPk(id, { plain: true });
  }

  async create(
    createChangeRequestDto: CreateChangeRequestDto,
    requester: string,
  ): Promise<ChangeRequest> {
    return this.changeRequestModel.create({
      title: createChangeRequestDto.title,
      description: createChangeRequestDto.description,
      requester,
      approvalRoute: createChangeRequestDto.approvalRoute,
      comments: createChangeRequestDto.comments || '',
      activities: createChangeRequestDto.activities ?? [],
      vmIds: createChangeRequestDto.vmIds ?? [],
      allowedRoles: createChangeRequestDto.allowedRoles ?? [],
      implementerGroupIds: createChangeRequestDto.implementerGroupIds ?? [],
      status: ChangeRequestStatus.Pending,
      history: [
        {
          when: new Date().toISOString(),
          actor: requester,
          action: 'Created',
          note: createChangeRequestDto.comments || 'New change submitted.',
        },
      ],
    } as any);
  }

  async update(
    id: string,
    updateChangeRequestDto: UpdateChangeRequestDto,
    actor: string,
  ): Promise<ChangeRequest | undefined> {
    const request = await this.findOne(id);
    if (!request) {
      return undefined;
    }

    if (request.status !== ChangeRequestStatus.Pending) {
      throw new BadRequestException(
        'Approved or rejected change requests cannot be edited',
      );
    }

    request.title = updateChangeRequestDto.title || request.title;
    request.description =
      updateChangeRequestDto.description || request.description;
    request.approvalRoute =
      updateChangeRequestDto.approvalRoute || request.approvalRoute;
    request.comments = updateChangeRequestDto.comments || request.comments;
    request.activities =
      updateChangeRequestDto.activities ?? request.activities;
    request.vmIds = updateChangeRequestDto.vmIds ?? request.vmIds;
    request.allowedRoles =
      updateChangeRequestDto.allowedRoles ?? request.allowedRoles;
    request.implementerGroupIds =
      updateChangeRequestDto.implementerGroupIds ?? request.implementerGroupIds;
    request.history = [
      ...request.history,
      {
        when: new Date().toISOString(),
        actor,
        action: 'Modified',
        note: updateChangeRequestDto.comments || 'Request updated.',
      },
    ];

    return request.save();
  }

  async approve(
    id: string,
    approver: string,
  ): Promise<ChangeRequest | undefined> {
    const request = await this.findOne(id);
    if (!request) {
      return undefined;
    }
    request.status = ChangeRequestStatus.Approved;
    request.approver = approver;
    request.history = [
      ...request.history,
      {
        when: new Date().toISOString(),
        actor: approver,
        action: 'Approved',
        note: request.comments || 'Approved for implementation.',
      },
    ];

    return request.save();
  }

  async reject(
    id: string,
    approver: string,
  ): Promise<ChangeRequest | undefined> {
    const request = await this.findOne(id);
    if (!request) {
      return undefined;
    }

    request.status = ChangeRequestStatus.Rejected;
    request.approver = approver;
    request.history = [
      ...request.history,
      {
        when: new Date().toISOString(),
        actor: approver,
        action: 'Rejected',
        note: request.comments || 'Rejected pending additional details.',
      },
    ];

    return request.save();
  }
}
