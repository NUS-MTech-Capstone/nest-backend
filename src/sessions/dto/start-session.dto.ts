import { IsOptional, IsString, IsUUID } from 'class-validator';

export class StartSessionDto {
  @IsUUID()
  hostId: string;

  @IsOptional()
  @IsUUID()
  crId?: string;

  @IsOptional()
  @IsString()
  osUser?: string;

  @IsOptional()
  @IsString()
  connectionType?: string;
}
