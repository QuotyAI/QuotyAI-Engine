import { Injectable, Logger } from '@nestjs/common';
import { AiFakeConversationMessagesGenerationAgentService } from '../ai-agents/ai-fake-conversation-messages-generation.agent';
import { AiMessageToSchemaConversionAgentService } from '../ai-agents/ai-message-to-schema-conversion.agent';
import { LangchainCongigService } from '../ai-agents/langchain-config.service';

@Injectable()
export class ExampleGeneratorService {
  private readonly logger = new Logger(ExampleGeneratorService.name);

  constructor(
    private readonly aiFakeConversationAgent: AiFakeConversationMessagesGenerationAgentService,
    private readonly aiMessageToSchemaAgent: AiMessageToSchemaConversionAgentService,
    private readonly llmConfigService: LangchainCongigService,
  ) {}


  // Generate example request body from TypeScript interface schema using AI agents
  async generateExampleFromSchema(
    pricingAgentContext: string,
    functionSchema: string,
    functionCode: string,
    tenantId?: string
  ): Promise<any> {
    try {
      this.logger.debug('Generating example from schema using AI agents');

      // Get LLM configuration
      const llmConfig = await this.llmConfigService.getTenantLLMConfig(tenantId);
      this.logger.debug('Retrieved LLM configuration');

      // Generate fake conversation
      const conversationResult = await this.aiFakeConversationAgent.generateDemoConversation({
        pricingAgentContext,
        functionSchema,
        functionCode,
      }, llmConfig);

      this.logger.debug(`Generated conversation with ${conversationResult.conversationHistory.length} messages`);

      // Convert conversation to structured schema data
      const schemaResult = await this.aiMessageToSchemaAgent.convertOrder({
        conversationHistory: conversationResult.conversationHistory,
        newUserMessage: conversationResult.nextUserMessage,
        schema: functionSchema,
      }, llmConfig);

      this.logger.debug('Successfully converted conversation to structured data');
      return schemaResult.structuredOrderInput;
    } catch (error) {
      this.logger.error('Error generating example from schema using AI agents:', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  // Generate chat conversation example using AI agent
  async generateChatExample(
    pricingAgentContext: string,
    functionSchema: string,
    functionCode: string,
    tenantId?: string
  ): Promise<any> {
    try {
      this.logger.debug('Generating chat example using AI agent');

      // Get LLM configuration
      const llmConfig = await this.llmConfigService.getTenantLLMConfig(tenantId);
      this.logger.debug('Retrieved LLM configuration for chat example');

      // Generate fake conversation
      const conversationResult = await this.aiFakeConversationAgent.generateDemoConversation({
        pricingAgentContext,
        functionSchema,
        functionCode,
      }, llmConfig);

      this.logger.debug(`Generated chat conversation with ${conversationResult.conversationHistory.length} messages`);

      return {
        input: conversationResult.nextUserMessage,
        conversation: conversationResult.conversationHistory.map(msg => ({
          message: msg.message,
          role: msg.role === 'AI' ? 'AI' : 'User'
        }))
      };
    } catch (error) {
      this.logger.error('Error generating chat example using AI agent:', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}
