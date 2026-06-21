import { BadRequestException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AuthUser } from '../auth/auth.types';
import { CreateChangeRequestDto } from './dto/create-change-request.dto';
import { UpdateChangeRequestDto } from './dto/update-change-request.dto';
import {
  ChangeRequest,
  ChangeRequestStatus,
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
      const osUsers = [
        ...new Set(groups.flatMap((group) => group.osUsers)),
      ];
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
    return this.changeRequestModel.findByPk(id);
  }

  /**
   * Parse an ISO datetime and ensure it is not in the past.
   * Allows a 60-second grace window for clock skew.
   */
  private parseRequiredDate(raw: string, field: string): Date {
    const date = new Date(raw);
    if (isNaN(date.getTime())) {
      throw new UnprocessableEntityException(`${field} is not a valid date`);
    }
    return date;
  }

  private assertStartNotInPast(start: Date): void {
    const sixtySecondsAgo = new Date(Date.now() - 60_000);
    if (start < sixtySecondsAgo) {
      throw new UnprocessableEntityException(
        'implementationStartAt cannot be set to a date in the past',
      );
    }
  }

  private assertValidImplementationWindow(start: Date, end: Date): void {
    if (end <= start) {
      throw new UnprocessableEntityException(
        'implementationEndAt must be after implementationStartAt',
      );
    }
  }

  private parseImplementationWindow(
    startRaw: string,
    endRaw: string,
    validateStartNotInPast = true,
  ): { implementationStartAt: Date; implementationEndAt: Date } {
    const implementationStartAt = this.parseRequiredDate(
      startRaw,
      'implementationStartAt',
    );
    const implementationEndAt = this.parseRequiredDate(
      endRaw,
      'implementationEndAt',
    );
    if (validateStartNotInPast) {
      this.assertStartNotInPast(implementationStartAt);
    }
    this.assertValidImplementationWindow(implementationStartAt, implementationEndAt);
    return { implementationStartAt, implementationEndAt };
  }

  async create(
    dto: CreateChangeRequestDto,
    user: AuthUser,
  ): Promise<ChangeRequest> {
    const requester = user.name ?? user.email ?? user.username;
    const { implementationStartAt, implementationEndAt } =
      this.parseImplementationWindow(
        dto.implementationStartAt,
        dto.implementationEndAt,
      );
    return this.changeRequestModel.create({
      title: dto.title,
      description: dto.description,
      requester,
      approvalRoute: dto.approvalRoute,
      comments: dto.comments || '',
      activities: dto.activities ?? [],
      vmIds: dto.vmIds ?? [],
      allowedRoles: dto.allowedRoles ?? [],
      implementerGroupIds: dto.implementerGroupIds ?? [],
      implementationStartAt,
      implementationEndAt,
      status: ChangeRequestStatus.Pending,
      history: [
        {
          when: new Date().toISOString(),
          actor: requester,
          action: 'Created',
          note: dto.comments || 'New change submitted.',
        },
      ],
    } as any);
  }

  async update(
    id: string,
    dto: UpdateChangeRequestDto,
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

    if (dto.title !== undefined) request.title = dto.title;
    if (dto.description !== undefined) request.description = dto.description;
    if (dto.approvalRoute !== undefined) request.approvalRoute = dto.approvalRoute;
    if (dto.comments !== undefined) request.comments = dto.comments;
    if (dto.activities !== undefined) request.activities = dto.activities;
    if (dto.vmIds !== undefined) request.vmIds = dto.vmIds;
    if (dto.allowedRoles !== undefined) request.allowedRoles = dto.allowedRoles;
    if (dto.implementerGroupIds !== undefined)
      request.implementerGroupIds = dto.implementerGroupIds;
    if (
      dto.implementationStartAt !== undefined ||
      dto.implementationEndAt !== undefined
    ) {
      const startRaw =
        dto.implementationStartAt ?? request.implementationStartAt.toISOString();
      const endRaw =
        dto.implementationEndAt ?? request.implementationEndAt.toISOString();
      const window = this.parseImplementationWindow(
        startRaw,
        endRaw,
        dto.implementationStartAt !== undefined,
      );
      request.implementationStartAt = window.implementationStartAt;
      request.implementationEndAt = window.implementationEndAt;
    }

    request.history = [
      ...request.history,
      {
        when: new Date().toISOString(),
        actor: request.requester,
        action: 'Modified',
        note: dto.comments || 'Request updated.',
      },
    ];

    return request.save();
  }

  async approve(id: string, user: AuthUser): Promise<ChangeRequest | undefined> {
    const request = await this.findOne(id);
    if (!request) {
      return undefined;
    }

    if (request.status !== ChangeRequestStatus.Pending) {
      throw new BadRequestException(
        'Only pending change requests can be approved',
      );
    }

    const approver = user.name ?? user.email ?? user.username;
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

  async reject(id: string, user: AuthUser): Promise<ChangeRequest | undefined> {
    const request = await this.findOne(id);
    if (!request) {
      return undefined;
    }

    if (request.status !== ChangeRequestStatus.Pending) {
      throw new BadRequestException(
        'Only pending change requests can be rejected',
      );
    }

    const approver = user.name ?? user.email ?? user.username;
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
