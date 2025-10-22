import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { LLMConfigurationDto } from './llm-configuration.dto';

export class UpdateTenantChatbotLlmConfigDto {
  @ApiProperty({
    description: 'The chatbot LLM configuration for the tenant',
    type: LLMConfigurationDto,
  })
  @ValidateNested()
  @Type(() => LLMConfigurationDto)
  chatbotLlmConfiguration: LLMConfigurationDto;
}
