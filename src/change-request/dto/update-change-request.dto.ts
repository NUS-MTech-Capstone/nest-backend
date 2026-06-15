import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ROLES } from '../../auth/auth.constants';

export class UpdateChangeRequestDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  approvalRoute?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comments?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  activities?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  vmIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsIn(ROLES, { each: true })
  allowedRoles?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  implementerGroupIds?: string[];
}
