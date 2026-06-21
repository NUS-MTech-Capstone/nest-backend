import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateChangeRequestDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsString()
  approvalRoute: string;

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

  /** ISO 8601 date string. Must not be in the past. */
  @IsOptional()
  @IsString()
  scheduledDate?: string;
}
