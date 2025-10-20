import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentBuilderModule } from './ai-agents/ai-agents.module';
import { PricingAgentsController } from './controllers/pricing-agents.controller';
import { PlaygroundController } from './controllers/playground.controller';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true
    }),
    AgentBuilderModule,
    HealthModule,
    AuthModule
  ],
  controllers: [
    PricingAgentsController, 
    PlaygroundController, 
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
    DynamicRunnerService
  ],
})
export class AppModule {}
