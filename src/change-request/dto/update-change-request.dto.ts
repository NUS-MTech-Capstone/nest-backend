import { IsArray, IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateChangeRequestDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  approvalRoute?: string;

  @IsOptional()
  @IsString()
  comments?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  activities?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  vmIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedRoles?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  implementerGroupIds?: string[];

  /** ISO 8601 datetime. Must not be in the past. */
  @IsOptional()
  @IsDateString()
  implementationStartAt?: string;

  /** ISO 8601 datetime. Must be after implementationStartAt. */
  @IsOptional()
  @IsDateString()
  implementationEndAt?: string;
}
