import { ApiProperty } from '@nestjs/swagger';
import { LLMProvider } from '../models/mongodb.model';

export class LLMConfigurationResponseDto {
  @ApiProperty({ enum: LLMProvider, enumName: 'LLMProvider' })
  provider: LLMProvider;

  @ApiProperty({ type: String })
  model: string;

  @ApiProperty({ type: String, required: false })
  baseUrl?: string; // For custom endpoints like Azure OpenAI

  @ApiProperty({ type: Object, required: false })
  additionalConfig?: Record<string, any>; // For provider-specific configuration

  @ApiProperty({ type: Boolean })
  useByok: boolean;
}
