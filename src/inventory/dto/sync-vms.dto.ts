import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AssetStatus } from '../vm.entity';

export class SyncVmRecord {
  @IsString()
  hostname: string;

  @IsString()
  ipAddress: string;

  @IsOptional()
  @IsEnum(AssetStatus)
  assetStatus?: AssetStatus;

  @IsString()
  osVersion: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  sshPort?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class SyncVmsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncVmRecord)
  servers: SyncVmRecord[];
}

export interface SyncResult {
  created: number;
  updated: number;
  unchanged: number;
}
