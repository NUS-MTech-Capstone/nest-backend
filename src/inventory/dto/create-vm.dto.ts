import { AssetStatus } from '../vm.entity';

export class CreateVmDto {
  hostname: string;
  ipAddress: string;
  assetStatus?: AssetStatus;
  osVersion: string;
  sshPort?: number;
}
