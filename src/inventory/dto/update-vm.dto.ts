import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { AssetStatus } from '../vm.entity';

export class UpdateVmDto {
  @IsOptional()
  @IsString()
  hostname?: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsEnum(AssetStatus)
  assetStatus?: AssetStatus;

  @IsOptional()
  @IsString()
  osVersion?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  sshPort?: number;
}
