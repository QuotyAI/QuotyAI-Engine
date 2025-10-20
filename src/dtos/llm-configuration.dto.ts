import { IsEnum, IsString, IsOptional, IsObject, IsBoolean } from 'class-validator';
import { LLMProvider } from '../models/mongodb.model';

export class LLMConfigurationDto {
  @IsEnum(LLMProvider)
  provider: LLMProvider;

  @IsString()
  model: string;

  @IsString()
  apiKey: string;

  @IsOptional()
  @IsString()
  baseUrl?: string; // For custom endpoints like Azure OpenAI

  @IsOptional()
  @IsObject()
  additionalConfig?: Record<string, any>; // For provider-specific configuration

  @IsBoolean()
  useByok: boolean;
}
