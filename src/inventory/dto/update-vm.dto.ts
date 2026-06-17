import { AssetStatus } from '../vm.entity';

export class UpdateVmDto {
  hostname?: string;
  ipAddress?: string;
  assetStatus?: AssetStatus;
  osVersion?: string;
  sshPort?: number;
}
