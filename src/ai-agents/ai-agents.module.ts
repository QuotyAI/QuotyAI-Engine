import { Module } from '@nestjs/common';
import { AiFormulaGenerationAgentService } from './ai-formula-generation.agent';
import { AiHappyPathDatasetGenerationAgentService } from './ai-happy-path-dataset-generation.agent';
import { AiOrderConversionAgentService } from './ai-order-conversion.agent';
import { databaseConfig } from '../config/database.config';
import { AiUnhappyPathDatasetGenerationAgentService } from './ai-unhappy-path-tests-generation.agent';
import { AiTestsetGenerationAgentService } from './ai-testset-generator.agent';
import { AiSchemaGenerationAgentService } from './ai-schema-generation.agent';
import { AiPlaygroundMessageAgentService } from './ai-playground-message.agent';
import { AiDemoConversationAgentService } from './ai-demo-conversation.agent';
import { AiPricingTableExtractionAgentService } from './ai-pricing-table-extraction.agent';
import { LLMService } from './llm.service';

@Module({
  imports: [],
  controllers: [],
  providers: [
    databaseConfig,
    LLMService,
    AiFormulaGenerationAgentService,
    AiHappyPathDatasetGenerationAgentService,
    AiUnhappyPathDatasetGenerationAgentService,
    AiOrderConversionAgentService,
    AiSchemaGenerationAgentService,
    AiTestsetGenerationAgentService,
    AiPlaygroundMessageAgentService,
    AiDemoConversationAgentService,
    AiPricingTableExtractionAgentService
  ],
  exports: [
    'DATABASE_CONNECTION',
    LLMService,
    AiFormulaGenerationAgentService,
    AiHappyPathDatasetGenerationAgentService,
    AiUnhappyPathDatasetGenerationAgentService,
    AiOrderConversionAgentService,
    AiSchemaGenerationAgentService,
    AiTestsetGenerationAgentService,
    AiPlaygroundMessageAgentService,
    AiDemoConversationAgentService,
    AiPricingTableExtractionAgentService
  ],
})
export class AgentBuilderModule {}
