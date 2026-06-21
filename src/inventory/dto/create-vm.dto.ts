import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { AssetStatus } from '../vm.entity';

export class CreateVmDto {
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
}
