import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentBuilderModule } from './ai-agents/ai-agents.module';
import { BuilderController } from './controllers/builder.controller';
import { PlaygroundController } from './controllers/playground.controller';
import { TestingDatasetController } from './controllers/testing-dataset.controller';
import { PricingTableExtractionController } from './controllers/pricing-table-extraction.controller';
import { PricingAgentService } from './services/pricing-agent.service';
import { TestingDatasetService } from './services/testing-dataset.service';
import { databaseConfig } from './config/database.config';
import { DynamicRunnerService } from './services/dynamic-runner.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    AgentBuilderModule
  ],
  controllers: [BuilderController, PlaygroundController, TestingDatasetController, PricingTableExtractionController],
  providers: [
    databaseConfig, 
    PricingAgentService, 
    TestingDatasetService,
    DynamicRunnerService
  ],
})
export class AppModule {}
