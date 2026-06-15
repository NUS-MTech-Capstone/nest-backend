import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateMembershipRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  username: string;

  @IsUUID('4')
  implementerGroupId: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comments?: string;
}
