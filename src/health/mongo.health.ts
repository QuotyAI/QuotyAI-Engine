import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { Inject } from '@nestjs/common';

@Injectable()
export class MongoHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject('DATABASE_CONNECTION') private readonly db: any,
  ) {}

  async isHealthy(key: string) {
    const indicator = this.healthIndicatorService.check(key);

    try {
      // Simple ping to check if database is accessible
      await this.db.admin().ping();
      return indicator.up();
    } catch (error) {
      return indicator.down({ message: error.message });
    }
  }
}
