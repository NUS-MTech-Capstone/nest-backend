import { IsArray, IsString } from 'class-validator';

export class SetTagsDto {
  @IsArray()
  @IsString({ each: true })
  tags: string[];
}
