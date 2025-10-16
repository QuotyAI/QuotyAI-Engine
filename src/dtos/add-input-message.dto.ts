import { IsString, IsOptional, IsArray, IsEnum } from 'class-validator';
import { TagEnum } from '../models/mongodb.model';

export class AddHumanInputMessageDto {
  @IsString()
  @IsOptional()
  message?: string;

  @IsArray()
  @IsEnum(TagEnum, { each: true })
  @IsOptional()
  tags?: TagEnum[];
}
