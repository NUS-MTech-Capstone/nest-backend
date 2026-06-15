import {
  IsEnum,
  IsIP,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { InventoryChangeAction } from '../inventory-change-request.entity';
import { AssetStatus } from '../vm.entity';

export class CreateInventoryChangeRequestDto {
  @IsEnum(InventoryChangeAction)
  action: InventoryChangeAction;

  @IsOptional()
  @IsUUID('4')
  targetVmId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(253)
  hostname: string;

  @IsIP()
  ipAddress: string;

  @IsOptional()
  @IsEnum(AssetStatus)
  assetStatus?: AssetStatus;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  osVersion: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  sshPort?: number;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comments?: string;
}
