import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  HealthCheck,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { MongoHealthIndicator } from './mongo.health';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private mongoHealth: MongoHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.mongoHealth.isHealthy('database')
    ]);
  }
}
