import { ApiProperty } from '@nestjs/swagger';

export class ChatMessageDto {
  @ApiProperty({ type: String, description: 'The message content' })
  message: string;

  @ApiProperty({ type: String, description: 'The role of the message sender (e.g., User, AI)' })
  role: string;
}

export class ChatConversationDto {
  @ApiProperty({ type: String, description: 'The initial input for the conversation' })
  input: string;

  @ApiProperty({ type: [ChatMessageDto], description: 'Array of conversation messages' })
  conversation: ChatMessageDto[];
}

export class ExampleRequestBodiesDto {
  @ApiProperty({ type: Object, description: 'Example request body for price calculation based on the agent\'s schema' })
  calculatePrice: Record<string, any>;

  @ApiProperty({ type: ChatConversationDto, description: 'Example request body for chat conversation' })
  chatConversation: ChatConversationDto;
}
