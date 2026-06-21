import {
  Controller,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { Public } from '../auth/decorators';
import { InventoryService } from './inventory.service';

interface StaticServerInventoryEntry {
  hostId?: string;
  address?: string;
  status?: string;
  connectionType?: string;
  username?: string;
  credentialSecretId?: string;
  hostPublicKey?: string;
  automation?: {
    serviceName?: string;
    healthUrl?: string;
    helperPath?: string;
    allowedOperations?: string[];
  };
}

export interface ServerInventoryResponse {
  hostId: string;
  hostname: string;
  address: string;
  status: string;
  connectionType: string;
  username: string;
  credentialSecretId: string;
  hostPublicKey: string;
  automation?: StaticServerInventoryEntry['automation'];
}

@Controller('servers')
export class ServerInventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get(':hostId')
  @Public()
  async getServer(@Param('hostId') hostId: string): Promise<ServerInventoryResponse> {
    const vm = await this.inventoryService.findByIdOrHostname(hostId);
    if (!vm) {
      throw new NotFoundException(`Server ${hostId} not found`);
    }

    const staticInventory = this.staticInventory()[vm.hostname] ?? this.staticInventory()[vm.id];
    const response: ServerInventoryResponse = {
      hostId: vm.hostname,
      hostname: vm.hostname,
      address: staticInventory?.address ?? `${vm.ipAddress}:${vm.sshPort ?? 22}`,
      status: staticInventory?.status ?? vm.assetStatus,
      connectionType: staticInventory?.connectionType ?? 'ssh',
      username: staticInventory?.username ?? process.env.SERVER_INVENTORY_DEFAULT_USERNAME ?? '',
      credentialSecretId:
        staticInventory?.credentialSecretId ??
        process.env.SERVER_INVENTORY_DEFAULT_CREDENTIAL_SECRET_ID ??
        '',
      hostPublicKey:
        staticInventory?.hostPublicKey ??
        process.env.SERVER_INVENTORY_DEFAULT_HOST_PUBLIC_KEY ??
        '',
      automation: staticInventory?.automation,
    };

    if (!response.username || !response.credentialSecretId || !response.hostPublicKey) {
      throw new InternalServerErrorException(
        `Server ${vm.hostname} is missing SSH inventory metadata`,
      );
    }

    return response;
  }

  private staticInventory(): Record<string, StaticServerInventoryEntry> {
    const raw = process.env.SERVER_INVENTORY_STATIC_JSON;
    if (!raw) {
      return {};
    }
    try {
      return JSON.parse(raw) as Record<string, StaticServerInventoryEntry>;
    } catch {
      throw new InternalServerErrorException('SERVER_INVENTORY_STATIC_JSON is invalid JSON');
    }
  }
}
