import { AssetStatus } from '../vm.entity';

export class SyncVmRecord {
  hostname: string;
  ipAddress: string;
  assetStatus?: AssetStatus;
  osVersion: string;
  sshPort?: number;
  tags?: string[];
}

export class SyncVmsDto {
  servers: SyncVmRecord[];
}

export interface SyncResult {
  created: number;
  updated: number;
  unchanged: number;
}
