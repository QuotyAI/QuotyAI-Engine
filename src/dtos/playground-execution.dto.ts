import { ApiProperty } from '@nestjs/swagger';
import { QuoteResult } from 'src/models/mongodb.model';
import { QuoteResultDTO } from './checkpoint-testset.dto';
import { IsOptional, IsString } from 'class-validator';

export class ChatbotMessage {
  @ApiProperty({ description: 'The message text' })
  message: string;

  @ApiProperty({ description: 'The role of the message sender', enum: ['AI', 'User'] })
  role: 'AI' | 'User';
}

export class PlaygroundExecutionRequestDto {
  @IsString()
  input: string;
  @IsOptional()
  conversation?: ChatbotMessage[];
}

export class PlaygroundExecutionResponseDto {
  @ApiProperty({ description: 'The structured order input converted from natural language' })
  structuredOrder: any;

  @ApiProperty({ description: 'The result from executing the pricing function' })
  functionResult: QuoteResultDTO;

  @ApiProperty({ description: 'The AI-generated response message for the playground conversation' })
  aiMessage: string;
}

export class DemoConversationResponseDto {
  @ApiProperty({
    description: 'Conversation history with previous messages',
    type: [ChatbotMessage],
    required: false
  })
  conversationHistory: ChatbotMessage[];

  @ApiProperty({ description: 'The next user message for order confirmation' })
  nextUserMessage: string;
}