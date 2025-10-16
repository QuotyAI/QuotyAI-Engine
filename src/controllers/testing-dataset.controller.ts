import { Controller, Post, Get, Put, Delete, Body, Param, Query, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { TestingDatasetService } from '../services/testing-dataset.service';
import { PricingAgentService } from '../services/pricing-agent.service';
import { TestingDataset } from '../models/mongodb.model';
import { CheckpointTestsetDto } from '../dtos/checkpoint-testset.dto';
import { AssignmentResultDto } from '../dtos/assignment-result.dto';
import { TestingDatasetWithTestsDto } from '../dtos/testing-dataset-with-tests.dto';

@ApiTags('quality')
@Controller('quality')
export class TestingDatasetController {
  private readonly logger = new Logger(TestingDatasetController.name);

  constructor(
    private readonly testingDatasetService: TestingDatasetService,
    private readonly pricingAgentService: PricingAgentService
  ) {
    this.logger.log('TestingDatasetController initialized');
  }

  @Get('testing-datasets')
  @ApiOperation({ summary: 'Search testing datasets with flexible criteria' })
  @ApiQuery({ name: 'checkpointId', description: 'Filter by checkpoint ID (optional)', required: false })
  @ApiQuery({ name: 'tenantId', description: 'Filter by tenant ID', required: true })
  @ApiQuery({ name: 'name', description: 'Search by dataset name (case-insensitive)', required: false })
  @ApiQuery({ name: 'description', description: 'Search by dataset description (case-insensitive)', required: false })
  @ApiQuery({ name: 'limit', description: 'Maximum number of results to return', required: false })
  @ApiResponse({ status: 200, description: 'Testing datasets retrieved successfully', type: [TestingDataset] })
  @ApiResponse({ status: 400, description: 'Bad request - tenantId is required' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async findTestingDatasets(
    @Query('tenantId') tenantId: string,
    @Query('checkpointId') checkpointId?: string,
    @Query('name') name?: string,
    @Query('description') description?: string,
    @Query('limit') limit?: string
  ): Promise<TestingDataset[]> {
    this.logger.log(`Finding testing datasets with criteria - checkpointId: ${checkpointId}, tenantId: ${tenantId}, name: ${name}, description: ${description}, limit: ${limit}`);

    try {
      if (!tenantId) {
        this.logger.warn('tenantId is required for testing datasets search');
        throw new HttpException('tenantId is required', HttpStatus.BAD_REQUEST);
      }

      const searchCriteria: any = {};

      if (checkpointId) {
        searchCriteria.checkpointId = checkpointId;
      }

      searchCriteria.tenantId = tenantId;

      if (name) {
        searchCriteria.name = name;
      }

      if (description) {
        searchCriteria.description = description;
      }

      if (limit) {
        const limitNum = parseInt(limit, 10);
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
          this.logger.warn(`Invalid limit parameter: ${limit}`);
          throw new HttpException('Limit must be a number between 1 and 1000', HttpStatus.BAD_REQUEST);
        }
        searchCriteria.limit = limitNum;
      }

      const datasets = await this.testingDatasetService.findTestingDatasets(searchCriteria);

      this.logger.log(`Successfully retrieved ${datasets.length} testing datasets`);
      return datasets;
    } catch (error) {
      this.logger.error(`Failed to find testing datasets: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to find testing datasets: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('testing-datasets')
  @ApiOperation({ summary: 'Create a new testing dataset' })
  @ApiQuery({ name: 'tenantId', description: 'Tenant ID', required: true })
  @ApiResponse({ status: 201, description: 'Testing dataset created successfully', type: TestingDataset })
  @ApiResponse({ status: 400, description: 'Bad request - missing required parameters' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async createTestingDataset(
    @Body() body: { name: string; description?: string; happyPathTests?: any[]; unhappyPathTests?: any[] },
    @Query('tenantId') tenantId: string
  ): Promise<TestingDataset> {
    this.logger.log(`Creating testing dataset: ${body.name} for tenant: ${tenantId}`);

    try {
      if (!tenantId || !body.name) {
        this.logger.warn(`Missing required parameters - tenantId: ${tenantId}, name: ${body.name}`);
        throw new HttpException(
          'tenantId (query param) and name are required',
          HttpStatus.BAD_REQUEST
        );
      }

      const datasetData = {
        tenantId,
        name: body.name,
        description: body.description || '',
        happyPathTests: body.happyPathTests || [],
        unhappyPathTests: body.unhappyPathTests || []
      };

      const dataset = await this.testingDatasetService.createTestingDataset(datasetData);
      this.logger.log(`Created testing dataset with ID: ${dataset._id}`);
      return dataset;
    } catch (error) {
      this.logger.error(`Failed to create testing dataset: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to create testing dataset: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('testing-datasets/:id')
  @ApiOperation({ summary: 'Get a specific testing dataset by ID' })
  @ApiParam({ name: 'id', description: 'Testing dataset ID' })
  @ApiQuery({ name: 'tenantId', description: 'Tenant ID', required: false })
  @ApiResponse({ status: 200, description: 'Testing dataset retrieved successfully', type: TestingDataset })
  @ApiResponse({ status: 404, description: 'Testing dataset not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getTestingDataset(@Param('id') id: string, @Query('tenantId') tenantId?: string): Promise<TestingDataset> {
    this.logger.log(`Getting testing dataset: ${id} for tenant: ${tenantId}`);

    try {
      const dataset = await this.testingDatasetService.findOneTestingDataset(id, tenantId);
      if (!dataset) {
        this.logger.warn(`Testing dataset not found: ${id} for tenant: ${tenantId}`);
        throw new HttpException('Testing dataset not found', HttpStatus.NOT_FOUND);
      }
      this.logger.log(`Successfully retrieved testing dataset: ${dataset.name} (${id})`);
      return dataset;
    } catch (error) {
      this.logger.error(`Failed to get testing dataset ${id}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to get testing dataset: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('testing-datasets/:id/with-tests')
  @ApiOperation({ summary: 'Get a specific testing dataset by ID with loaded tests' })
  @ApiParam({ name: 'id', description: 'Testing dataset ID' })
  @ApiQuery({ name: 'tenantId', description: 'Tenant ID', required: false })
  @ApiResponse({ status: 200, description: 'Testing dataset with tests retrieved successfully', type: TestingDatasetWithTestsDto })
  @ApiResponse({ status: 404, description: 'Testing dataset not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getTestingDatasetWithTests(@Param('id') id: string, @Query('tenantId') tenantId?: string): Promise<TestingDatasetWithTestsDto> {
    this.logger.log(`Getting testing dataset with tests: ${id} for tenant: ${tenantId}`);

    try {
      const dataset = await this.testingDatasetService.findOneTestingDatasetWithTests(id, tenantId);
      if (!dataset) {
        this.logger.warn(`Testing dataset not found: ${id} for tenant: ${tenantId}`);
        throw new HttpException('Testing dataset not found', HttpStatus.NOT_FOUND);
      }
      this.logger.log(`Successfully retrieved testing dataset with tests: ${dataset.name} (${id})`);
      return dataset;
    } catch (error) {
      this.logger.error(`Failed to get testing dataset with tests ${id}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to get testing dataset with tests: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Put('testing-datasets/:id')
  @ApiOperation({ summary: 'Update a testing dataset' })
  @ApiParam({ name: 'id', description: 'Testing dataset ID' })
  @ApiQuery({ name: 'tenantId', description: 'Tenant ID', required: false })
  @ApiResponse({ status: 200, description: 'Testing dataset updated successfully', type: TestingDataset })
  @ApiResponse({ status: 404, description: 'Testing dataset not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async updateTestingDataset(
    @Param('id') id: string,
    @Body() body: Partial<Pick<TestingDataset, 'name' | 'description'>>,
    @Query('tenantId') tenantId?: string
  ): Promise<TestingDataset> {
    this.logger.log(`Updating testing dataset: ${id} for tenant: ${tenantId}`);

    try {
      const dataset = await this.testingDatasetService.updateTestingDataset(id, body, tenantId);
      if (!dataset) {
        this.logger.warn(`Testing dataset not found for update: ${id} for tenant: ${tenantId}`);
        throw new HttpException('Testing dataset not found', HttpStatus.NOT_FOUND);
      }
      this.logger.log(`Successfully updated testing dataset: ${dataset.name} (${id})`);
      return dataset;
    } catch (error) {
      this.logger.error(`Failed to update testing dataset ${id}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to update testing dataset: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete('testing-datasets/:id')
  @ApiOperation({ summary: 'Delete a testing dataset' })
  @ApiParam({ name: 'id', description: 'Testing dataset ID' })
  @ApiQuery({ name: 'tenantId', description: 'Tenant ID', required: false })
  @ApiResponse({ status: 200, description: 'Testing dataset deleted successfully', schema: { type: 'object', properties: { deleted: { type: 'boolean' } } } })
  @ApiResponse({ status: 404, description: 'Testing dataset not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async deleteTestingDataset(@Param('id') id: string, @Query('tenantId') tenantId?: string): Promise<{ deleted: boolean }> {
    this.logger.log(`Deleting testing dataset: ${id} for tenant: ${tenantId}`);

    try {
      const deleted = await this.testingDatasetService.deleteTestingDataset(id, tenantId);
      if (!deleted) {
        this.logger.warn(`Testing dataset not found for deletion: ${id} for tenant: ${tenantId}`);
        throw new HttpException('Testing dataset not found', HttpStatus.NOT_FOUND);
      }
      this.logger.log(`Successfully deleted testing dataset: ${id}`);
      return { deleted: true };
    } catch (error) {
      this.logger.error(`Failed to delete testing dataset ${id}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to delete testing dataset: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('pricing-agents/:agentId/checkpoints/:checkpointId/datasets/:datasetId')
  @ApiOperation({ summary: 'Assign a testing dataset to a pricing agent checkpoint' })
  @ApiParam({ name: 'agentId', description: 'Pricing agent ID' })
  @ApiParam({ name: 'datasetId', description: 'Testing dataset ID' })
  @ApiQuery({ name: 'tenantId', description: 'Tenant ID', required: false })
  @ApiResponse({ status: 200, description: 'Testing dataset assigned successfully', type: AssignmentResultDto })
  @ApiResponse({ status: 400, description: 'Bad request - dataset already assigned or invalid parameters' })
  @ApiResponse({ status: 404, description: 'Pricing agent, checkpoint, or dataset not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async assignTestingDataset(
    @Param('agentId') agentId: string,
    @Param('datasetId') datasetId: string,
    @Query('tenantId') tenantId?: string
  ): Promise<AssignmentResultDto> {
    this.logger.log(`Assigning testing dataset: ${datasetId} for agent: ${agentId} for tenant: ${tenantId}`);

    try {
      // Validate agent exists
      const agent = await this.pricingAgentService.findOne(agentId, tenantId);
      if (!agent) {
        this.logger.warn(`Pricing agent not found: ${agentId} for tenant: ${tenantId}`);
        throw new HttpException('Pricing agent not found', HttpStatus.NOT_FOUND);
      }

      // Validate dataset exists
      const dataset = await this.testingDatasetService.findOneTestingDataset(datasetId, tenantId);
      if (!dataset) {
        this.logger.warn(`Testing dataset not found: ${datasetId} for tenant: ${tenantId}`);
        throw new HttpException('Testing dataset not found', HttpStatus.NOT_FOUND);
      }

      // Check if dataset is already assigned to this checkpoint
      const existingAssignments = await this.testingDatasetService.findTestingDatasetAssignments(agentId, datasetId, tenantId);

      if (existingAssignments.length > 0) {
        this.logger.warn(`Testing dataset ${datasetId} is already assigned to agent ${agentId}`);
        throw new HttpException('Testing dataset is already assigned to this checkpoint', HttpStatus.BAD_REQUEST);
      }

      await this.testingDatasetService.assignTestingDataset(agentId, datasetId, tenantId!);

      this.logger.log(`Successfully assigned testing dataset: ${datasetId} to agent: ${agentId}`);
      return {
        agentId: agentId,
        datasetId: dataset._id!.toString(),
        tenantId: tenantId || '',
        assignedAt: new Date(),
        message: 'Testing dataset assigned successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to assign testing dataset ${datasetId} for agent ${agentId}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to assign testing dataset: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('pricing-agents/:agentId/build/dataset')
  @ApiOperation({ summary: 'AI generate testing dataset' })
  @ApiParam({ name: 'agentId', description: 'Pricing agent ID' })
  @ApiQuery({ name: 'tenantId', description: 'Tenant ID', required: false })
  @ApiQuery({ name: 'checkpointId', description: 'Checkpoint ID (optional, uses latest if not provided)', required: false })
  @ApiResponse({ status: 200, description: 'Dataset generated successfully', type: TestingDatasetWithTestsDto })
  @ApiResponse({ status: 404, description: 'Pricing agent or checkpoint not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async aiGenerateDataset(
    @Param('agentId') agentId: string,
    @Query('tenantId') tenantId?: string,
    @Query('checkpointId') checkpointId?: string
  ): Promise<TestingDatasetWithTestsDto> {
    this.logger.log(`Building tests for agent: ${agentId} for tenant: ${tenantId}`);

    try {
      // If checkpointId is not provided, get the latest checkpoint for the agent
      let targetCheckpointId = checkpointId;
      if (!targetCheckpointId) {
        const latestCheckpoint = await this.pricingAgentService.findLatestCheckpoint(agentId, tenantId);
        if (!latestCheckpoint) {
          this.logger.warn(`No checkpoint found for tests build: ${agentId} for tenant: ${tenantId}`);
          throw new HttpException('No checkpoint found for the specified agent', HttpStatus.NOT_FOUND);
        }
        targetCheckpointId = latestCheckpoint._id!.toString();
      }

      const checkpoint = await this.pricingAgentService.findOneCheckpoint(targetCheckpointId, tenantId);
      if (!checkpoint) {
        this.logger.warn(`Checkpoint not found for tests build: ${agentId}, checkpoint: ${targetCheckpointId}`);
        throw new HttpException('Checkpoint not found', HttpStatus.NOT_FOUND);
      }

      const agent = await this.pricingAgentService.findOne(agentId, tenantId);
      if (!agent) {
        this.logger.warn(`Pricing agent not found for tests build: ${agentId}`);
        throw new HttpException('Pricing agent not found', HttpStatus.NOT_FOUND);
      }

      const result = await this.testingDatasetService.aiGenerateDataset(checkpoint, agent.name);

      this.logger.log(`Successfully built tests for agent: ${agentId}, checkpoint: ${checkpoint._id}`);

      const dataset = await this.testingDatasetService.findOneTestingDatasetWithTests(result._id!.toString(), tenantId);
      return dataset;
    } catch (error) {
      this.logger.error(`Failed to build tests for agent ${agentId}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to build tests: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }  

  @Get('pricing-agents/:agentId/checkpoints/:checkpointId/testset')
  @ApiOperation({ summary: 'Get checkpoint testset with test data' })
  @ApiParam({ name: 'agentId', description: 'Pricing agent ID' })
  @ApiParam({ name: 'checkpointId', description: 'Checkpoint ID' })
  @ApiQuery({ name: 'tenantId', description: 'Tenant ID', required: false })
  @ApiResponse({ status: 200, description: 'Testset retrieved successfully', type: CheckpointTestsetDto })
  @ApiResponse({ status: 404, description: 'Pricing agent or checkpoint not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getCheckpointTestset(
    @Param('agentId') agentId: string,
    @Param('checkpointId') checkpointId: string,
    @Query('tenantId') tenantId?: string
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

  @Post('pricing-agents/:agentId/build/testset')
  @ApiOperation({ summary: 'AI generate testset from assigned datasets' })
  @ApiParam({ name: 'agentId', description: 'Pricing agent ID' })
  @ApiQuery({ name: 'tenantId', description: 'Tenant ID', required: false })
  @ApiQuery({ name: 'checkpointId', description: 'Checkpoint ID (optional, uses latest if not provided)', required: false })
  @ApiResponse({ status: 200, description: 'Testset generated successfully', type: CheckpointTestsetDto })
  @ApiResponse({ status: 400, description: 'Bad request - no assigned datasets or missing schema' })
  @ApiResponse({ status: 404, description: 'Pricing agent or checkpoint not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async aiGenerateCheckpointTestsetFromAssignedDatasets(
    @Param('agentId') agentId: string,
    @Query('tenantId') tenantId?: string,
    @Query('checkpointId') checkpointId?: string
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
  @ApiQuery({ name: 'tenantId', description: 'Tenant ID', required: false })
  @ApiQuery({ name: 'checkpointId', description: 'Checkpoint ID (optional, uses latest if not provided)', required: false })
  @ApiQuery({ name: 'failFast', description: 'Stop execution on first unexpected failure', required: false })
  @ApiResponse({ status: 200, description: 'Tests executed successfully', type: CheckpointTestsetDto })
  @ApiResponse({ status: 404, description: 'Pricing agent or checkpoint not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async runCheckpointTestset(
    @Param('agentId') agentId: string,
    @Query('tenantId') tenantId?: string,
    @Query('checkpointId') checkpointId?: string,
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
