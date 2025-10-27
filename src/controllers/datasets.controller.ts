import { Controller, Post, Get, Put, Delete, Body, Param, Query, Headers, HttpException, HttpStatus, Logger, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiHeader } from '@nestjs/swagger';
import { TestingDatasetService } from '../services/testing-dataset.service';
import { TestingDataset } from '../models/mongodb.model';
import { TestingDatasetWithTestsDto } from '../dtos/testing-dataset-with-tests.dto';
import { CreateTestingDatasetDto } from '../dtos/create-testing-dataset.dto';
import { AuthGuard } from '../auth/auth.guard';

@ApiTags('datasets')
@Controller('datasets')
@UseGuards(AuthGuard)
export class DatasetsController {
  private readonly logger = new Logger(DatasetsController.name);

  constructor(
    private readonly testingDatasetService: TestingDatasetService
  ) {
    this.logger.log('DatasetsController initialized');
  }

  @Get('')
  @ApiOperation({ summary: 'Search testing datasets with flexible criteria' })
  @ApiQuery({ name: 'agentId', description: 'Filter by agentId (optional)', required: false })
  @ApiQuery({ name: 'name', description: 'Search by dataset name (case-insensitive)', required: false })
  @ApiQuery({ name: 'description', description: 'Search by dataset description (case-insensitive)', required: false })
  @ApiQuery({ name: 'limit', description: 'Maximum number of results to return', required: false })
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Filter by tenant ID', required: false })
  @ApiResponse({ status: 200, description: 'Testing datasets retrieved successfully', type: [TestingDataset] })
  @ApiResponse({ status: 400, description: 'Bad request - tenantId is required' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async findTestingDatasets(
    @Headers('X-Tenant-ID') tenantId?: string,
    @Query('agentId') agentId?: string,
    @Query('name') name?: string,
    @Query('description') description?: string,
    @Query('limit') limit?: string
  ): Promise<TestingDataset[]> {
    this.logger.log(`Finding testing datasets with criteria - agentId: ${agentId}, tenantId: ${tenantId}, name: ${name}, description: ${description}, limit: ${limit}`);

    try {

      const searchCriteria: any = {};

      if (agentId) {
        searchCriteria.agentId = agentId;
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

  @Post('')
  @ApiOperation({ summary: 'Create a new testing dataset' })
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant ID', required: false })
  @ApiResponse({ status: 201, description: 'Testing dataset created successfully', type: TestingDataset })
  @ApiResponse({ status: 400, description: 'Bad request - missing required parameters' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async createTestingDataset(
    @Body() body: CreateTestingDatasetDto,
    @Headers('X-Tenant-ID') tenantId?: string
  ): Promise<TestingDataset> {
    this.logger.log(`Creating testing dataset: ${body.name} for tenant: ${tenantId}`);

    try {
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

  @Get('/:id')
  @ApiOperation({ summary: 'Get a specific testing dataset by ID' })
  @ApiParam({ name: 'id', description: 'Testing dataset ID' })
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant ID', required: false })
  @ApiResponse({ status: 200, description: 'Testing dataset retrieved successfully', type: TestingDataset })
  @ApiResponse({ status: 404, description: 'Testing dataset not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getTestingDataset(@Param('id') id: string, @Headers('X-Tenant-ID') tenantId?: string): Promise<TestingDataset> {
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

  @Get('/:id/with-tests')
  @ApiOperation({ summary: 'Get a specific testing dataset by ID with loaded tests' })
  @ApiParam({ name: 'id', description: 'Testing dataset ID' })
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant ID', required: false })
  @ApiResponse({ status: 200, description: 'Testing dataset with tests retrieved successfully', type: TestingDatasetWithTestsDto })
  @ApiResponse({ status: 404, description: 'Testing dataset not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getTestingDatasetWithTests(@Param('id') id: string, @Headers('X-Tenant-ID') tenantId?: string): Promise<TestingDatasetWithTestsDto> {
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

  @Put('/:id')
  @ApiOperation({ summary: 'Update a testing dataset' })
  @ApiParam({ name: 'id', description: 'Testing dataset ID' })
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant ID', required: false })
  @ApiResponse({ status: 200, description: 'Testing dataset updated successfully', type: TestingDataset })
  @ApiResponse({ status: 404, description: 'Testing dataset not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async updateTestingDataset(
    @Param('id') id: string,
    @Body() body: Partial<Pick<TestingDataset, 'name' | 'description'>>,
    @Headers('X-Tenant-ID') tenantId?: string
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

  @Delete('/:id')
  @ApiOperation({ summary: 'Delete a testing dataset' })
  @ApiParam({ name: 'id', description: 'Testing dataset ID' })
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant ID', required: false })
  @ApiResponse({ status: 200, description: 'Testing dataset deleted successfully', schema: { type: 'object', properties: { deleted: { type: 'boolean' } } } })
  @ApiResponse({ status: 404, description: 'Testing dataset not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async deleteTestingDataset(@Param('id') id: string, @Headers('X-Tenant-ID') tenantId?: string): Promise<{ deleted: boolean }> {
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
}
