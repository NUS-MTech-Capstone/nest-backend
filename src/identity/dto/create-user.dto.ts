import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ROLES } from '../../auth/auth.constants';

export class CreateUserDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  username: string;

  @IsEmail()
  @MaxLength(320)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsArray()
  @ArrayMaxSize(6)
  @IsIn(ROLES, { each: true })
  roles: string[];
}
