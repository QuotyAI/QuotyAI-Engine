import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
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
import { LangchainCongigService } from './ai-agents/langchain-config.service';
import { AiFormulaGenerationAgentService } from './ai-agents/ai-formula-generation.agent';
import { AiHappyPathDatasetGenerationAgentService } from './ai-agents/ai-happy-path-dataset-generation.agent';
import { AiUnhappyPathDatasetGenerationAgentService } from './ai-agents/ai-unhappy-path-tests-generation.agent';
import { AiMessageToSchemaConversionAgentService } from './ai-agents/ai-message-to-schema-conversion.agent';
import { AiSchemaGenerationAgentService } from './ai-agents/ai-schema-generation.agent';
import { AiDatasetToTestsetGenerationAgentService } from './ai-agents/ai-dataset-to-testset-generation.agent';
import { NaturalLanguageResponseGenerationAgentService } from './ai-agents/ai-natural-language-response-generation.agent';
import { AiFakeConversationMessagesGenerationAgentService } from './ai-agents/ai-fake-conversation-messages-generation.agent';
import { AiOcrPricingTablesAgentService } from './ai-agents/ai-ocr-pricing-tables.agent';
import { ExampleGeneratorService } from './services/example-generator.service';
import { OpenApiGeneratorService } from './services/openapi-generator.service';
import { TenantAccessMiddleware } from './middleware/tenant-access.middleware';

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
    LangchainCongigService,
    AiFormulaGenerationAgentService,
    AiHappyPathDatasetGenerationAgentService,
    AiUnhappyPathDatasetGenerationAgentService,
    AiMessageToSchemaConversionAgentService,
    AiSchemaGenerationAgentService,
    AiDatasetToTestsetGenerationAgentService,
    NaturalLanguageResponseGenerationAgentService,
    AiFakeConversationMessagesGenerationAgentService,
    AiOcrPricingTablesAgentService,
    ExampleGeneratorService,
    OpenApiGeneratorService
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantAccessMiddleware)
      .forRoutes('*'); // Apply to all routes
  }
}
