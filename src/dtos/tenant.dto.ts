import { ApiProperty } from '@nestjs/swagger';
import { ObjectId } from 'mongodb';
import { Subscription } from '../models/mongodb.model';
import { LLMConfigurationResponseDto } from './llm-configuration-response.dto';

export class TenantDto {
  @ApiProperty({ name: '_id', type: String, format: 'uuid' })
  _id?: ObjectId;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String, required: false })
  description?: string;

  @ApiProperty({ type: Boolean, default: true })
  isActive: boolean;

  @ApiProperty({ type: Subscription, required: false })
  subscription?: Subscription;

  @ApiProperty({ type: LLMConfigurationResponseDto, required: false })
  builderLlmConfiguration?: LLMConfigurationResponseDto;

  @ApiProperty({ type: LLMConfigurationResponseDto, required: false })
  chatbotLlmConfiguration?: LLMConfigurationResponseDto;

  @ApiProperty({ type: Date })
  createdAt: Date;

  @ApiProperty({ type: Date, required: false })
  updatedAt?: Date;

  @ApiProperty({ type: Date, required: false })
  deletedAt?: Date | null;
}
