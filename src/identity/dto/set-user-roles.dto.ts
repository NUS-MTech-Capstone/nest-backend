import { ArrayMaxSize, IsArray, IsIn } from 'class-validator';
import { ROLES } from '../../auth/auth.constants';

export class SetUserRolesDto {
  @IsArray()
  @ArrayMaxSize(6)
  @IsIn(ROLES, { each: true })
  roles: string[];
}
