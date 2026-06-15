import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  ValidateNested,
} from 'class-validator';
import { PERMISSIONS, ROLES } from '../../auth/auth.constants';

export class PolicyRowDto {
  @IsIn(ROLES)
  role!: string;

  @IsArray()
  @ArrayMaxSize(PERMISSIONS.length)
  @ArrayUnique()
  @IsIn(PERMISSIONS, { each: true })
  permissions!: string[];
}

export class UpdatePoliciesDto {
  @IsArray()
  @ArrayMaxSize(ROLES.length)
  @ValidateNested({ each: true })
  @Type(() => PolicyRowDto)
  policies!: PolicyRowDto[];
}
