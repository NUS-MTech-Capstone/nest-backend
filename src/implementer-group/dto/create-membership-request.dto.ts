import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateMembershipRequestDto {
  @IsString()
  username: string;

  @IsUUID('4')
  implementerGroupId: string;

  @IsString()
  requester: string;

  @IsOptional()
  @IsString()
  comments?: string;
}
