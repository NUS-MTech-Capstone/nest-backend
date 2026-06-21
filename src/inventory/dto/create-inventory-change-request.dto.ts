import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { AssetStatus } from '../vm.entity';
import { InventoryChangeAction } from '../inventory-change-request.entity';

export class CreateInventoryChangeRequestDto {
  @IsEnum(InventoryChangeAction)
  action: InventoryChangeAction;

  @IsOptional()
  @IsUUID('4')
  targetVmId?: string;

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
  @IsString()
  comments?: string;
}
