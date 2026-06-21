import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateImplementerGroupDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  osUsers?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  vmIds?: string[];
}
