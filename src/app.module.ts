import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PricingAgentsController } from './controllers/pricing-agents.controller';
import { PlaygroundController } from './controllers/playground.controller';
import { IntegrationsController } from './controllers/integrations.controller';
import { ApiKeysController } from './controllers/api-keys.controller';
import { TestsetsController } from './controllers/testsets.controller';
import { ExtractionController } from './controllers/extraction.controller';
import { TenantController } from './controllers/tenant.controller';
import { PricingAgentService } from './services/pricing-agent.service';
import { TestingDatasetService } from './services/testing-dataset.service';
import { TenantService } from './services/tenant.service';
import { databaseConfig } from './config/database.config';
import { DynamicRunnerService } from './services/dynamic-runner.service';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { DatasetsController } from './controllers/datasets.controller';
import { AuthController } from './controllers/auth.controller';
import { ApiKeyService } from './services/api-key.service';
import { LLMService } from './ai-agents/llm.service';
import { AiFormulaGenerationAgentService } from './ai-agents/ai-formula-generation.agent';
import { AiHappyPathDatasetGenerationAgentService } from './ai-agents/ai-happy-path-dataset-generation.agent';
import { AiUnhappyPathDatasetGenerationAgentService } from './ai-agents/ai-unhappy-path-tests-generation.agent';
import { AiOrderConversionAgentService } from './ai-agents/ai-order-conversion.agent';
import { AiSchemaGenerationAgentService } from './ai-agents/ai-schema-generation.agent';
import { AiTestsetGenerationAgentService } from './ai-agents/ai-testset-generator.agent';
import { AiPlaygroundMessageAgentService } from './ai-agents/ai-playground-message.agent';
import { AiDemoConversationAgentService } from './ai-agents/ai-demo-conversation.agent';
import { AiPricingTableExtractionAgentService } from './ai-agents/ai-pricing-table-extraction.agent';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true
    }),
    HealthModule,
    AuthModule
  ],
  controllers: [
    PricingAgentsController,
    PlaygroundController,
    IntegrationsController,
    ApiKeysController,
    DatasetsController,
    TestsetsController,
    ExtractionController,
    TenantController,
    AuthController
  ],
  providers: [
    databaseConfig,
    PricingAgentService,
    DatasetsController,
    TestingDatasetService,
    TenantService,
    DynamicRunnerService,
    ApiKeyService,
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
export class AppModule {}
