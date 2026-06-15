import { IsBoolean } from 'class-validator';

export class SetUserStatusDto {
  @IsBoolean()
  enabled: boolean;
}
