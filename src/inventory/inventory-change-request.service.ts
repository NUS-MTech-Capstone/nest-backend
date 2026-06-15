import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CreateInventoryChangeRequestDto } from './dto/create-inventory-change-request.dto';
import {
  InventoryChangeAction,
  InventoryChangeRequest,
  InventoryChangeStatus,
} from './inventory-change-request.entity';
import { InventoryService } from './inventory.service';
import { AssetStatus } from './vm.entity';

@Injectable()
export class InventoryChangeRequestService {
  constructor(
    @InjectModel(InventoryChangeRequest)
    private inventoryChangeRequestModel: typeof InventoryChangeRequest,
    private inventoryService: InventoryService,
  ) {}

  findAll(): Promise<InventoryChangeRequest[]> {
    return this.inventoryChangeRequestModel.findAll({
      order: [['createdAt', 'DESC']],
    });
  }

  findOne(id: string): Promise<InventoryChangeRequest | null> {
    return this.inventoryChangeRequestModel.findByPk(id, { plain: true });
  }

  async create(
    dto: CreateInventoryChangeRequestDto,
    requester: string,
  ): Promise<InventoryChangeRequest> {
    if (dto.action === InventoryChangeAction.Update) {
      if (!dto.targetVmId) {
        throw new BadRequestException(
          'targetVmId is required for update requests',
        );
      }

      const vm = await this.inventoryService.findOne(dto.targetVmId);
      if (!vm) {
        throw new NotFoundException(
          `Virtual machine with ID ${dto.targetVmId} not found`,
        );
      }

      const pendingUpdate = await this.inventoryChangeRequestModel.findOne({
        where: {
          targetVmId: dto.targetVmId,
          status: InventoryChangeStatus.Pending,
        },
      });
      if (pendingUpdate) {
        throw new BadRequestException(
          'This server already has a pending update request',
        );
      }
    }

    if (dto.action === InventoryChangeAction.Add) {
      const existingVm = await this.inventoryService.findByHostname(
        dto.hostname,
      );
      if (existingVm) {
        throw new BadRequestException(
          `A server with hostname ${dto.hostname} already exists`,
        );
      }

      const pendingAdd = await this.inventoryChangeRequestModel.findOne({
        where: {
          hostname: dto.hostname,
          action: InventoryChangeAction.Add,
          status: InventoryChangeStatus.Pending,
        },
      });
      if (pendingAdd) {
        throw new BadRequestException(
          `A pending add request already exists for ${dto.hostname}`,
        );
      }
    }

    const actionLabel =
      dto.action === InventoryChangeAction.Add ? 'Add server' : 'Update server';

    return this.inventoryChangeRequestModel.create({
      action: dto.action,
      requester,
      targetVmId: dto.targetVmId,
      hostname: dto.hostname,
      ipAddress: dto.ipAddress,
      assetStatus: dto.assetStatus ?? AssetStatus.Active,
      osVersion: dto.osVersion,
      sshPort: dto.sshPort ?? 22,
      comments: dto.comments || '',
      status: InventoryChangeStatus.Pending,
      history: [
        {
          when: new Date().toISOString(),
          actor: requester,
          action: 'Submitted',
          note: dto.comments || `${actionLabel} submitted for approval.`,
        },
      ],
    } as any);
  }

  async approve(
    id: string,
    approver: string,
  ): Promise<InventoryChangeRequest | undefined> {
    const request = await this.findOne(id);
    if (!request) {
      return undefined;
    }

    if (request.status !== InventoryChangeStatus.Pending) {
      throw new BadRequestException(
        'Only pending inventory change requests can be approved',
      );
    }

    if (request.action === InventoryChangeAction.Add) {
      const existingVm = await this.inventoryService.findByHostname(
        request.hostname,
      );
      if (existingVm) {
        throw new BadRequestException(
          `A server with hostname ${request.hostname} already exists`,
        );
      }

      await this.inventoryService.create({
        hostname: request.hostname,
        ipAddress: request.ipAddress,
        assetStatus: request.assetStatus,
        osVersion: request.osVersion,
        sshPort: request.sshPort,
      });
    } else {
      const updated = await this.inventoryService.update(request.targetVmId!, {
        hostname: request.hostname,
        ipAddress: request.ipAddress,
        assetStatus: request.assetStatus,
        osVersion: request.osVersion,
        sshPort: request.sshPort,
      });
      if (!updated) {
        throw new NotFoundException(
          `Virtual machine with ID ${request.targetVmId} not found`,
        );
      }
    }

    request.status = InventoryChangeStatus.Approved;
    request.approver = approver;
    request.history = [
      ...request.history,
      {
        when: new Date().toISOString(),
        actor: approver,
        action: 'Approved',
        note: request.comments || 'Inventory change approved.',
      },
    ];

    return request.save();
  }

  async reject(
    id: string,
    approver: string,
  ): Promise<InventoryChangeRequest | undefined> {
    const request = await this.findOne(id);
    if (!request) {
      return undefined;
    }

    if (request.status !== InventoryChangeStatus.Pending) {
      throw new BadRequestException(
        'Only pending inventory change requests can be rejected',
      );
    }

    request.status = InventoryChangeStatus.Rejected;
    request.approver = approver;
    request.history = [
      ...request.history,
      {
        when: new Date().toISOString(),
        actor: approver,
        action: 'Rejected',
        note: request.comments || 'Inventory change rejected.',
      },
    ];

    return request.save();
  }
}
