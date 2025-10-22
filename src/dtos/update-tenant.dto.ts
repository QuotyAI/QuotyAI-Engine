import { IsString, IsOptional, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { LLMConfigurationDto } from './llm-configuration.dto';
import { UpdateSubscriptionDto } from './update-subscription.dto';

export class UpdateTenantDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => LLMConfigurationDto)
  builderLlmConfiguration?: LLMConfigurationDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LLMConfigurationDto)
  chatbotLlmConfiguration?: LLMConfigurationDto;
}
