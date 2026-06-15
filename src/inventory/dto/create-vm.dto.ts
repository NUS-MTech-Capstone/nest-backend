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

export class CreateVmDto {
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
}
