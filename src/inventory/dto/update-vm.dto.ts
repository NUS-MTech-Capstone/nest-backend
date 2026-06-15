import {
  IsEnum,
  IsIP,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AssetStatus } from '../vm.entity';

export class UpdateVmDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(253)
  hostname?: string;

  @IsOptional()
  @IsIP()
  ipAddress?: string;

  @IsOptional()
  @IsEnum(AssetStatus)
  assetStatus?: AssetStatus;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  osVersion?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  sshPort?: number;
}
