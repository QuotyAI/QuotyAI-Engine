import { Controller, Post, Get, Put, Delete, Body, Param, Query, Headers, HttpException, HttpStatus, Logger, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiHeader } from '@nestjs/swagger';
import { TestingDatasetService } from '../services/testing-dataset.service';
import { PricingAgentService } from '../services/pricing-agent.service';
import { TestingDataset } from '../models/mongodb.model';
import { CheckpointTestsetDto } from '../dtos/checkpoint-testset.dto';
import { AssignmentResultDto } from '../dtos/assignment-result.dto';
import { TestingDatasetWithTestsDto } from '../dtos/testing-dataset-with-tests.dto';
import { AuthGuard } from '../auth/auth.guard';

@ApiTags('testsets')
@Controller('testsets')
@UseGuards(AuthGuard)
export class TestsetsController {
  private readonly logger = new Logger(TestsetsController.name);

  constructor(
    private readonly testingDatasetService: TestingDatasetService,
    private readonly pricingAgentService: PricingAgentService
  ) {
    this.logger.log('TestsetsController initialized');
  }

  @Get('/:agentId/:checkpointId/testset')
  @ApiOperation({ summary: 'Get checkpoint testset with test data' })
  @ApiParam({ name: 'agentId', description: 'Pricing agent ID' })
  @ApiParam({ name: 'checkpointId', description: 'Checkpoint ID' })
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant ID', required: false })
  @ApiResponse({ status: 200, description: 'Testset retrieved successfully', type: CheckpointTestsetDto })
  @ApiResponse({ status: 404, description: 'Pricing agent or checkpoint not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getCheckpointTestset(
    @Param('agentId') agentId: string,
    @Param('checkpointId') checkpointId: string,
    @Headers('X-Tenant-ID') tenantId?: string
  ): Promise<CheckpointTestsetDto> {
    this.logger.log(`Getting checkpoint testset for agent: ${agentId}, checkpoint: ${checkpointId} for tenant: ${tenantId}`);

    try {
      // Validate agent exists
      const agent = await this.pricingAgentService.findOne(agentId, tenantId);
      if (!agent) {
        this.logger.warn(`Pricing agent not found: ${agentId} for tenant: ${tenantId}`);
        throw new HttpException('Pricing agent not found', HttpStatus.NOT_FOUND);
      }

      // Validate checkpoint exists and belongs to the agent
      const checkpoint = await this.pricingAgentService.findOneCheckpoint(checkpointId, tenantId);
      if (!checkpoint) {
        this.logger.warn(`Checkpoint not found: ${checkpointId} for tenant: ${tenantId}`);
        throw new HttpException('Checkpoint not found', HttpStatus.NOT_FOUND);
      }

      if (checkpoint.pricingAgentId.toString() !== agentId) {
        this.logger.warn(`Checkpoint ${checkpointId} does not belong to agent ${agentId}`);
        throw new HttpException('Checkpoint does not belong to the specified agent', HttpStatus.NOT_FOUND);
      }

      const testset = await this.testingDatasetService.getCheckpointTestset(checkpoint);
      this.logger.log(`Successfully retrieved testset for checkpoint: ${checkpointId} for agent: ${agentId}`);
      return testset;
    } catch (error) {
      this.logger.error(`Failed to get checkpoint testset for checkpoint ${checkpointId} for agent ${agentId}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to get checkpoint testset: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('/:agentId/:checkpointId/testset')
  @ApiOperation({ summary: 'AI generate testset from assigned datasets' })
  @ApiParam({ name: 'agentId', description: 'Pricing agent ID' })
  @ApiParam({ name: 'checkpointId', description: 'Checkpoint ID' })
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant ID', required: false })
  @ApiResponse({ status: 200, description: 'Testset generated successfully', type: CheckpointTestsetDto })
  @ApiResponse({ status: 400, description: 'Bad request - no assigned datasets or missing schema' })
  @ApiResponse({ status: 404, description: 'Pricing agent or checkpoint not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async aiGenerateCheckpointTestsetFromAssignedDatasets(
    @Param('agentId') agentId: string,
    @Param('checkpointId') checkpointId: string,
    @Headers('X-Tenant-ID') tenantId?: string,
  ): Promise<CheckpointTestsetDto> {
    this.logger.log(`AI generating testset from assigned datasets for agent: ${agentId} for tenant: ${tenantId}`);

    try {
      // If checkpointId is not provided, get the latest checkpoint for the agent
      let targetCheckpointId = checkpointId;
      if (!targetCheckpointId) {
        const latestCheckpoint = await this.pricingAgentService.findLatestCheckpoint(agentId, tenantId);
        if (!latestCheckpoint) {
          this.logger.warn(`No checkpoint found for testset generation: ${agentId} for tenant: ${tenantId}`);
          throw new HttpException('No checkpoint found for the specified agent', HttpStatus.NOT_FOUND);
        }
        targetCheckpointId = latestCheckpoint._id!.toString();
      }

      const checkpoint = await this.pricingAgentService.findOneCheckpoint(targetCheckpointId, tenantId);
      if (!checkpoint) {
        this.logger.warn(`Checkpoint not found for testset generation: ${agentId}, checkpoint: ${targetCheckpointId}`);
        throw new HttpException('Checkpoint not found', HttpStatus.NOT_FOUND);
      }

      await this.testingDatasetService.aiGenerateTestsetFromAssignedDatasets(checkpoint);

      this.logger.log(`Successfully generated testset for agent: ${agentId}, checkpoint: ${checkpoint._id}`);
      const testset = await this.testingDatasetService.getCheckpointTestset(checkpoint);
      return testset;
    } catch (error) {
      this.logger.error(`Failed to generate testset for agent ${agentId}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to generate testset: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('pricing-agents/:agentId/test')
  @ApiOperation({ summary: 'Runs checkpoint testset' })
  @ApiParam({ name: 'agentId', description: 'Pricing agent ID' })
  @ApiParam({ name: 'checkpointId', description: 'Checkpoint ID' })
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant ID', required: false })
  @ApiQuery({ name: 'failFast', description: 'Stop execution on first unexpected failure', required: false })
  @ApiResponse({ status: 200, description: 'Tests executed successfully', type: CheckpointTestsetDto })
  @ApiResponse({ status: 404, description: 'Pricing agent or checkpoint not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async runCheckpointTestset(
    @Param('agentId') agentId: string,
    @Param('checkpointId') checkpointId: string,
    @Headers('X-Tenant-ID') tenantId?: string,
    @Query('failFast') failFast?: string
  ): Promise<CheckpointTestsetDto> {
    this.logger.log(`Running checkpoint testset for agent: ${agentId} for tenant: ${tenantId}`);

    try {
      // If checkpointId is not provided, get the latest checkpoint for the agent
      let targetCheckpointId = checkpointId;
      if (!targetCheckpointId) {
        const latestCheckpoint = await this.pricingAgentService.findLatestCheckpoint(agentId, tenantId);
        if (!latestCheckpoint) {
          this.logger.warn(`No checkpoint found for testset run: ${agentId} for tenant: ${tenantId}`);
          throw new HttpException('No checkpoint found for the specified agent', HttpStatus.NOT_FOUND);
        }
        targetCheckpointId = latestCheckpoint._id!.toString();
      }

      const failFastBool = failFast === 'true';
      const checkpoint = await this.pricingAgentService.findOneCheckpoint(targetCheckpointId, tenantId);
      if (!checkpoint) {
        this.logger.warn(`Checkpoint not found for testset run: ${agentId}, checkpoint: ${targetCheckpointId}`);
        throw new HttpException('Checkpoint not found', HttpStatus.NOT_FOUND);
      }

      await this.testingDatasetService.runCheckpointTestset(checkpoint, failFastBool);

      this.logger.log(`Successfully ran testset for agent: ${agentId}, checkpoint: ${targetCheckpointId}`);
      const testset = await this.testingDatasetService.getCheckpointTestset(checkpoint);
      return testset;
    } catch (error) {
      this.logger.error(`Failed to run testset for agent ${agentId}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to run testset: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
