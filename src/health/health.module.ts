import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { MongoHealthIndicator } from './mongo.health';
import { databaseConfig } from 'src/config/database.config';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [MongoHealthIndicator, databaseConfig],
})
export class HealthModule {}
