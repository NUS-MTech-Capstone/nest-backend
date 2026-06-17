import { AssetStatus } from '../vm.entity';
import { InventoryChangeAction } from '../inventory-change-request.entity';

export class CreateInventoryChangeRequestDto {
  action: InventoryChangeAction;
  targetVmId?: string;
  hostname: string;
  ipAddress: string;
  assetStatus?: AssetStatus;
  osVersion: string;
  sshPort?: number;
  comments?: string;
}
