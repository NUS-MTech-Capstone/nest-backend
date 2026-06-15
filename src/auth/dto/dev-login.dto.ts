import { IsString, Length } from 'class-validator';

export class DevLoginDto {
  @IsString()
  @Length(1, 64)
  username!: string;
}
