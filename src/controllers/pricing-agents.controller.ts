import { Controller, Post, Get, Put, Delete, Body, Param, Query, Headers, HttpException, HttpStatus, Logger, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiHeader } from '@nestjs/swagger';
import { PricingAgentService } from '../services/pricing-agent.service';
import { PricingAgent, PricingAgentCheckpoint } from '../models/mongodb.model';
import { PricingAgentWithLatestCheckpoint } from 'src/dtos/pricing-agent-with-latest-checkpoint.dto';
import { CreatePricingAgentDto } from '../dtos/create-pricing-agent.dto';
import { AddHumanInputMessageDto } from '../dtos/add-input-message.dto';
import { SetDeploymentStatusDto } from '../dtos/set-deployment-status.dto';
import { BuildSchemaDto } from '../dtos/build-schema.dto';
import { BuildFormulaDto } from '../dtos/build-formula.dto';
import { isMultiTenancyEnabled } from '../config/multi-tenancy.config';
import { AuthGuard } from '../auth/auth.guard';
import { TestingDatasetService } from 'src/services/testing-dataset.service';
import { AssignmentResultDto } from 'src/dtos/assignment-result.dto';
import { TestingDatasetWithTestsDto } from 'src/dtos/testing-dataset-with-tests.dto';
import { ExampleRequestBodiesDto } from 'src/dtos/example-request-bodies.dto';
import { ExampleGeneratorService } from 'src/services/example-generator.service';
import { OpenApiGeneratorService } from '../services/openapi-generator.service';

/**
 * REST API controller for pricing agent management and AI-powered code generation.
 *
 * This controller provides comprehensive HTTP endpoints for managing pricing agents,
 * their versioned checkpoints, and AI-generated code. It handles both CRUD operations
 * for pricing agents and orchestrates the AI-powered generation of TypeScript schemas
 * and pricing calculation functions.
 *
 * Key endpoints:
 * - Pricing agent lifecycle management (create, read, update, delete)
 * - Checkpoint history and versioning
 * - Human input message management
 * - AI schema generation with optional feedback
 * - AI function generation with optional feedback
 * - Testing dataset assignment and management
 * - Deployment status control
 *
 * All endpoints support multi-tenant isolation and require authentication.
 */
@ApiTags('pricing-agents')
@Controller('pricing-agents')
@UseGuards(AuthGuard)
export class PricingAgentsController {
  private readonly logger = new Logger(PricingAgentsController.name);

  constructor(
    private readonly pricingAgentService: PricingAgentService,
    private readonly testingDatasetService: TestingDatasetService,
    private readonly exampleGeneratorService: ExampleGeneratorService,
    ) {
    this.logger.log('pricingAgentsController initialized');
  }

  // Pricing Agent CRUD endpoints
  @Post('')
  @ApiOperation({ summary: 'Create a new pricing agent' })
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant ID (required in multi-tenant mode)', required: false })
  @ApiResponse({ status: 201, description: 'Pricing agent created successfully', type: PricingAgentWithLatestCheckpoint })
  @ApiResponse({ status: 400, description: 'Bad request - missing required parameters' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async createPricingAgent(
    @Body() body: CreatePricingAgentDto,
    @Headers('X-Tenant-ID') tenantId?: string
  ): Promise<PricingAgentWithLatestCheckpoint> {
    this.logger.log(`Creating pricing agent: ${body.name} for tenant: ${tenantId}`);

    try {
      if ((isMultiTenancyEnabled && !tenantId) || !body.name) {
        this.logger.warn(`Missing required parameters - tenantId: ${tenantId}, name: ${body.name}`);
        throw new HttpException(
          `${isMultiTenancyEnabled ? 'tenantId (header) and ' : ''}name are required`,
          HttpStatus.BAD_REQUEST
        );
      }

      // Create the pricing agent first
      const pricingAgentData = {
        tenantId,
        name: body.name,
        isDeployed: false,
      };
      const pricingAgent = await this.pricingAgentService.createPricingAgent(pricingAgentData);
      this.logger.log(`Created pricing agent with ID: ${pricingAgent._id}`);

      // Create an initial empty checkpoint
      const initialCheckpoint = {
        pricingAgentId: pricingAgent._id!,
        tenantId: pricingAgent.tenantId,
        version: 1,
        humanInputMessages: [],
        functionSchema: '',
        functionCode: '',
        checkpointTrigger: 'initial' as const,
        checkpointDescription: 'Initial checkpoint created with pricing agent',
      };
      await this.pricingAgentService.createCheckpoint(initialCheckpoint);
      this.logger.log(`Created initial checkpoint for pricing agent: ${pricingAgent._id}`);

      // Return the pricing agent with the latest checkpoint
      const agentsWithCheckpoints = await this.pricingAgentService.findAllPricingAgentsWithLatestCheckpoint(tenantId);
      const result = agentsWithCheckpoints.find(agent => agent._id!.equals(pricingAgent._id!))!;
      this.logger.log(`Successfully created pricing agent: ${body.name} with initial checkpoint`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to create pricing agent: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to create pricing agent: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('')
  @ApiOperation({ summary: 'Get all pricing agents for a tenant' })
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant ID (required in multi-tenant mode)', required: false })
  @ApiResponse({ status: 200, description: 'Pricing agents retrieved successfully', type: [PricingAgentWithLatestCheckpoint] })
  @ApiResponse({ status: 400, description: 'Bad request - tenantId required in multi-tenant mode' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getPricingAgents(@Headers('X-Tenant-ID') tenantId?: string): Promise<PricingAgentWithLatestCheckpoint[]> {
    this.logger.log(`Getting pricing agents for tenant: ${tenantId}`);

    try {
      if (isMultiTenancyEnabled && !tenantId) {
        this.logger.warn('tenantId is required in multi-tenant mode');
        throw new HttpException('tenantId is required in multi-tenant mode', HttpStatus.BAD_REQUEST);
      }

      const agents = await this.pricingAgentService.findAllPricingAgentsWithLatestCheckpoint(tenantId);
      this.logger.log(`Successfully retrieved ${agents.length} pricing agents for tenant: ${tenantId}`);
      return agents;
    } catch (error) {
      this.logger.error(`Failed to get pricing agents: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to get pricing agents: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('/:agentId')
  @ApiOperation({ summary: 'Get a specific pricing agent by ID' })
  @ApiParam({ name: 'agentId', description: 'Pricing agent ID' })
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant ID (required in multi-tenant mode)', required: false })
  @ApiResponse({ status: 200, description: 'Pricing agent retrieved successfully', type: PricingAgent })
  @ApiResponse({ status: 400, description: 'Bad request - tenantId required in multi-tenant mode' })
  @ApiResponse({ status: 404, description: 'Pricing agent not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getPricingAgent(@Param('agentId') agentId: string, @Headers('X-Tenant-ID') tenantId?: string): Promise<PricingAgent> {
    this.logger.log(`Getting pricing agent: ${agentId} for tenant: ${tenantId}`);

    try {
      if (isMultiTenancyEnabled && !tenantId) {
        this.logger.warn('tenantId is required in multi-tenant mode');
        throw new HttpException('tenantId is required in multi-tenant mode', HttpStatus.BAD_REQUEST);
      }

      const agent = await this.pricingAgentService.findOnePricingAgent(agentId, tenantId);
      if (!agent) {
        this.logger.warn(`Pricing agent not found: ${agentId} for tenant: ${tenantId}`);
        throw new HttpException('Pricing agent not found', HttpStatus.NOT_FOUND);
      }
      this.logger.log(`Successfully retrieved pricing agent: ${agent.name} (${agentId})`);
      return agent;
    } catch (error) {
      this.logger.error(`Failed to get pricing agent ${agentId}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to get pricing agent: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Put('/:agentId')
  @ApiOperation({ summary: 'Update a pricing agent' })
  @ApiParam({ name: 'agentId', description: 'Pricing agent ID' })
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant ID (required in multi-tenant mode)', required: false })
  @ApiResponse({ status: 200, description: 'Pricing agent updated successfully', type: PricingAgent })
  @ApiResponse({ status: 400, description: 'Bad request - tenantId required in multi-tenant mode' })
  @ApiResponse({ status: 404, description: 'Pricing agent not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async updatePricingAgent(
    @Param('agentId') agentId: string,
    @Body() body: Partial<Omit<PricingAgent, '_id' | 'createdAt'>>,
    @Headers('X-Tenant-ID') tenantId?: string
  ): Promise<PricingAgent> {
    this.logger.log(`Updating pricing agent: ${agentId} for tenant: ${tenantId}`);

    try {
      if (isMultiTenancyEnabled && !tenantId) {
        this.logger.warn('tenantId is required in multi-tenant mode');
        throw new HttpException('tenantId is required in multi-tenant mode', HttpStatus.BAD_REQUEST);
      }

      const agent = await this.pricingAgentService.updatePricingAgent(agentId, body, tenantId);
      if (!agent) {
        this.logger.warn(`Pricing agent not found for update: ${agentId} for tenant: ${tenantId}`);
        throw new HttpException('Pricing agent not found', HttpStatus.NOT_FOUND);
      }
      this.logger.log(`Successfully updated pricing agent: ${agent.name} (${agentId})`);
      return agent;
    } catch (error) {
      this.logger.error(`Failed to update pricing agent ${agentId}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to update pricing agent: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete('/:agentId')
  @ApiOperation({ summary: 'Delete a pricing agent' })
  @ApiParam({ name: 'agentId', description: 'Pricing agent ID' })
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant ID (required in multi-tenant mode)', required: false })
  @ApiResponse({ status: 200, description: 'Pricing agent deleted successfully', schema: { type: 'object', properties: { deleted: { type: 'boolean' } } } })
  @ApiResponse({ status: 400, description: 'Bad request - tenantId required in multi-tenant mode' })
  @ApiResponse({ status: 404, description: 'Pricing agent not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async deletePricingAgent(@Param('agentId') agentId: string, @Headers('X-Tenant-ID') tenantId?: string): Promise<{ deleted: boolean }> {
    this.logger.log(`Deleting pricing agent: ${agentId} for tenant: ${tenantId}`);

    try {
      if (isMultiTenancyEnabled && !tenantId) {
        this.logger.warn('tenantId is required in multi-tenant mode');
        throw new HttpException('tenantId is required in multi-tenant mode', HttpStatus.BAD_REQUEST);
      }

      const deleted = await this.pricingAgentService.deletePricingAgent(agentId, tenantId);
      if (!deleted) {
        this.logger.warn(`Pricing agent not found for deletion: ${agentId} for tenant: ${tenantId}`);
        throw new HttpException('Pricing agent not found', HttpStatus.NOT_FOUND);
      }
      this.logger.log(`Successfully deleted pricing agent: ${agentId}`);
      return { deleted: true };
    } catch (error) {
      this.logger.error(`Failed to delete pricing agent ${agentId}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to delete pricing agent: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('/:agentId/deployed')
  @ApiOperation({ summary: 'Set the deployment status of a pricing agent' })
  @ApiParam({ name: 'agentId', description: 'Pricing agent ID' })
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant ID (required in multi-tenant mode)', required: false })
  @ApiResponse({ status: 200, description: 'Pricing agent deployment status set successfully', type: PricingAgent })
  @ApiResponse({ status: 400, description: 'Bad request - tenantId required in multi-tenant mode or invalid parameters' })
  @ApiResponse({ status: 404, description: 'Pricing agent not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async setPricingAgentDeployment(@Param('agentId') agentId: string, @Body() body: SetDeploymentStatusDto, @Headers('X-Tenant-ID') tenantId?: string): Promise<PricingAgent> {
    this.logger.log(`Setting deployment status for pricing agent: ${agentId} to ${body.isDeployed} for tenant: ${tenantId}`);

    try {
      if (isMultiTenancyEnabled && !tenantId) {
        this.logger.warn('tenantId is required in multi-tenant mode');
        throw new HttpException('tenantId is required in multi-tenant mode', HttpStatus.BAD_REQUEST);
      }

      // Validate agent exists
      const agent = await this.pricingAgentService.findOnePricingAgent(agentId, tenantId);
      if (!agent) {
        this.logger.warn(`Pricing agent not found: ${agentId} for tenant: ${tenantId}`);
        throw new HttpException('Pricing agent not found', HttpStatus.NOT_FOUND);
      }

      // Set the isDeployed field to the specified value
      const updatedAgent = await this.pricingAgentService.updatePricingAgent(agentId, { isDeployed: body.isDeployed }, tenantId);
      if (!updatedAgent) {
        this.logger.warn(`Pricing agent not found for update: ${agentId} for tenant: ${tenantId}`);
        throw new HttpException('Pricing agent not found', HttpStatus.NOT_FOUND);
      }
      this.logger.log(`Successfully set deployment status for pricing agent: ${updatedAgent.name} (${agentId}) to ${updatedAgent.isDeployed}`);
      return updatedAgent;
    } catch (error) {
      this.logger.error(`Failed to set deployment status for pricing agent ${agentId}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to set deployment status: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('/:agentId/messages')
  @ApiOperation({ summary: 'Add input message to pricing agent' })
  @ApiParam({ name: 'agentId', description: 'Pricing agent ID' })
  @ApiQuery({ name: 'checkpointId', description: 'Checkpoint ID (optional, uses latest if not provided)', required: false })
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant ID', required: false })
  @ApiResponse({ status: 200, description: 'Input message added successfully', type: PricingAgentCheckpoint })
  @ApiResponse({ status: 400, description: 'Bad request - no valid input provided' })
  @ApiResponse({ status: 404, description: 'Pricing agent or checkpoint not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async addInputMessage(
    @Param('agentId') agentId: string,
    @Body() body: AddHumanInputMessageDto,
    @Query('checkpointId') checkpointId?: string,
    @Headers('X-Tenant-ID') tenantId?: string
  ): Promise<PricingAgentCheckpoint> {
    this.logger.log(`Adding input message to agent: ${agentId} for tenant: ${tenantId}`);

    try {
      if (!body.message && (!body.tags || body.tags.length === 0)) {
        this.logger.warn(`No valid input provided for agent: ${agentId}`);
        throw new HttpException(
          'At least one of message or tags must be provided',
          HttpStatus.BAD_REQUEST
        );
      }

      // If checkpointId is not provided, get the latest checkpoint for the agent
      let targetCheckpointId = checkpointId;
      if (!targetCheckpointId) {
        const latestCheckpoint = await this.pricingAgentService.findLatestCheckpoint(agentId, tenantId);
        if (!latestCheckpoint) {
          this.logger.warn(`No checkpoint found for agent: ${agentId} for tenant: ${tenantId}`);
          throw new HttpException('No checkpoint found for the specified agent', HttpStatus.NOT_FOUND);
        }
        targetCheckpointId = latestCheckpoint._id!.toString();
      }

      const checkpoint = await this.pricingAgentService.addInputMessage(agentId, targetCheckpointId, body, tenantId);
      if (!checkpoint) {
        this.logger.warn(`Pricing agent or checkpoint not found for agent: ${agentId}, checkpoint: ${targetCheckpointId}`);
        throw new HttpException('Pricing agent or checkpoint not found', HttpStatus.NOT_FOUND);
      }
      this.logger.log(`Successfully added input message to agent: ${agentId}, checkpoint: ${checkpoint._id}`);
      return checkpoint;
    } catch (error) {
      this.logger.error(`Failed to add input message to agent ${agentId}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to add input message: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete('/:agentId/checkpoints/:checkpointId/messages/:messageId')
  @ApiOperation({ summary: 'Delete an input message from a checkpoint' })
  @ApiParam({ name: 'agentId', description: 'Pricing agent ID' })
  @ApiParam({ name: 'checkpointId', description: 'Checkpoint ID' })
  @ApiParam({ name: 'messageId', description: 'Message ID' })
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant ID', required: false })
  @ApiResponse({ status: 200, description: 'Message deleted successfully', type: PricingAgentCheckpoint })
  @ApiResponse({ status: 404, description: 'Pricing agent, checkpoint, or message not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async deleteInputMessage(
    @Param('agentId') agentId: string,
    @Param('checkpointId') checkpointId: string,
    @Param('messageId') messageId: string,
    @Headers('X-Tenant-ID') tenantId?: string
  ): Promise<PricingAgentCheckpoint> {
    this.logger.log(`Deleting message: ${messageId} from checkpoint: ${checkpointId} for agent: ${agentId} for tenant: ${tenantId}`);

    try {
      // Validate agent exists
      const agent = await this.pricingAgentService.findOnePricingAgent(agentId, tenantId);
      if (!agent) {
        this.logger.warn(`Pricing agent not found: ${agentId} for tenant: ${tenantId}`);
        throw new HttpException('Pricing agent not found', HttpStatus.NOT_FOUND);
      }

      const checkpoint = await this.pricingAgentService.deleteInputMessage(agentId, checkpointId, messageId, tenantId);
      if (!checkpoint) {
        this.logger.warn(`Checkpoint not found: ${checkpointId} for tenant: ${tenantId}`);
        throw new HttpException('Checkpoint not found', HttpStatus.NOT_FOUND);
      }

      this.logger.log(`Successfully deleted message: ${messageId} from checkpoint: ${checkpointId} for agent: ${agentId}`);
      return checkpoint;
    } catch (error) {
      this.logger.error(`Failed to delete message ${messageId} from checkpoint ${checkpointId} for agent ${agentId}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      // Handle specific error for message not found
      if (error.message === 'Message not found in checkpoint') {
        throw new HttpException('Message not found', HttpStatus.NOT_FOUND);
      }

      throw new HttpException(
        `Failed to delete message: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('/:agentId/build/schema')
  @ApiOperation({ summary: 'Build schema only for pricing agent' })
  @ApiParam({ name: 'agentId', description: 'Pricing agent ID' })
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant ID', required: false })
  @ApiQuery({ name: 'checkpointId', description: 'Checkpoint ID (optional, uses latest if not provided)', required: false })
  @ApiResponse({ status: 200, description: 'Schema built successfully', type: PricingAgentCheckpoint })
  @ApiResponse({ status: 404, description: 'Pricing agent or checkpoint not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async buildSchema(
    @Param('agentId') agentId: string,
    @Body() body: BuildSchemaDto,
    @Headers('X-Tenant-ID') tenantId?: string,
    @Query('checkpointId') checkpointId?: string
  ): Promise<PricingAgentCheckpoint> {
    this.logger.log(`Building schema for agent: ${agentId} for tenant: ${tenantId}`);

    try {
      // If checkpointId is not provided, get the latest checkpoint for the agent
      let targetCheckpointId = checkpointId;
      if (!targetCheckpointId) {
        const latestCheckpoint = await this.pricingAgentService.findLatestCheckpoint(agentId, tenantId);
        if (!latestCheckpoint) {
          this.logger.warn(`No checkpoint found for schema build: ${agentId} for tenant: ${tenantId}`);
          throw new HttpException('No checkpoint found for the specified agent', HttpStatus.NOT_FOUND);
        }
        targetCheckpointId = latestCheckpoint._id!.toString();
      }

      const checkpoint = await this.pricingAgentService.buildSchemaOnly(agentId, targetCheckpointId, body.feedback, tenantId);
      if (!checkpoint) {
        this.logger.warn(`Pricing agent or checkpoint not found for schema build: ${agentId}, checkpoint: ${targetCheckpointId}`);
        throw new HttpException('Pricing agent or checkpoint not found', HttpStatus.NOT_FOUND);
      }
      this.logger.log(`Successfully built schema for agent: ${agentId}, checkpoint: ${checkpoint._id}`);
      return checkpoint;
    } catch (error) {
      this.logger.error(`Failed to build schema for agent ${agentId}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to build schema: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('/:agentId/build/formula')
  @ApiOperation({ summary: 'Build formula only for pricing agent' })
  @ApiParam({ name: 'agentId', description: 'Pricing agent ID' })
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant ID', required: false })
  @ApiQuery({ name: 'checkpointId', description: 'Checkpoint ID (optional, uses latest if not provided)', required: false })
  @ApiResponse({ status: 200, description: 'Formula built successfully', type: PricingAgentCheckpoint })
  @ApiResponse({ status: 404, description: 'Pricing agent or checkpoint not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async buildFormula(
    @Param('agentId') agentId: string,
    @Body() body: BuildFormulaDto,
    @Headers('X-Tenant-ID') tenantId?: string,
    @Query('checkpointId') checkpointId?: string
  ): Promise<PricingAgentCheckpoint> {
    this.logger.log(`Building formula for agent: ${agentId} for tenant: ${tenantId}`);

    try {
      // If checkpointId is not provided, get the latest checkpoint for the agent
      let targetCheckpointId = checkpointId;
      if (!targetCheckpointId) {
        const latestCheckpoint = await this.pricingAgentService.findLatestCheckpoint(agentId, tenantId);
        if (!latestCheckpoint) {
          this.logger.warn(`No checkpoint found for formula build: ${agentId} for tenant: ${tenantId}`);
          throw new HttpException('No checkpoint found for the specified agent', HttpStatus.NOT_FOUND);
        }
        targetCheckpointId = latestCheckpoint._id!.toString();
      }

      const checkpoint = await this.pricingAgentService.buildFormulaOnly(agentId, targetCheckpointId, body.feedback, tenantId);
      if (!checkpoint) {
        this.logger.warn(`Pricing agent or checkpoint not found for formula build: ${agentId}, checkpoint: ${targetCheckpointId}`);
        throw new HttpException('Pricing agent or checkpoint not found', HttpStatus.NOT_FOUND);
      }
      this.logger.log(`Successfully built formula for agent: ${agentId}, checkpoint: ${checkpoint._id}`);
      return checkpoint;
    } catch (error) {
      this.logger.error(`Failed to build formula for agent ${agentId}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to build formula: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('/:agentId/checkpoints')
  @ApiOperation({ summary: 'Get latest checkpoints for a pricing agent' })
  @ApiParam({ name: 'agentId', description: 'Pricing agent ID' })
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant ID', required: false })
  @ApiQuery({ name: 'limit', description: 'Maximum number of checkpoints to return (default: 50)', required: false })
  @ApiResponse({ status: 200, description: 'Checkpoints retrieved successfully', type: [PricingAgentCheckpoint] })
  @ApiResponse({ status: 404, description: 'Pricing agent not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getPricingAgentCheckpoints(
    @Param('agentId') agentId: string,
    @Headers('X-Tenant-ID') tenantId?: string,
    @Query('limit') limit?: string
  ): Promise<PricingAgentCheckpoint[]> {
    this.logger.log(`Getting latest checkpoints for agent: ${agentId} for tenant: ${tenantId}`);

    try {
      // Validate agent exists
      const agent = await this.pricingAgentService.findOnePricingAgent(agentId, tenantId);
      if (!agent) {
        this.logger.warn(`Pricing agent not found: ${agentId} for tenant: ${tenantId}`);
        throw new HttpException('Pricing agent not found', HttpStatus.NOT_FOUND);
      }

      const limitNum = limit ? parseInt(limit, 10) : 50;
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        this.logger.warn(`Invalid limit parameter: ${limit}`);
        throw new HttpException('Limit must be a number between 1 and 100', HttpStatus.BAD_REQUEST);
      }

      const checkpoints = await this.pricingAgentService.findLatestCheckpoints(agentId, tenantId, limitNum);
      this.logger.log(`Successfully retrieved ${checkpoints.length} checkpoints for agent: ${agentId}`);
      return checkpoints;
    } catch (error) {
      this.logger.error(`Failed to get checkpoints for agent ${agentId}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to get checkpoints: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('/:agentId/checkpoints/:checkpointId')
  @ApiOperation({ summary: 'Get full checkpoint data by ID' })
  @ApiParam({ name: 'agentId', description: 'Pricing agent ID' })
  @ApiParam({ name: 'checkpointId', description: 'Checkpoint ID' })
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant ID', required: false })
  @ApiResponse({ status: 200, description: 'Checkpoint retrieved successfully', type: PricingAgentCheckpoint })
  @ApiResponse({ status: 404, description: 'Pricing agent or checkpoint not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getPricingAgentCheckpoint(
    @Param('agentId') agentId: string,
    @Param('checkpointId') checkpointId: string,
    @Headers('X-Tenant-ID') tenantId?: string
  ): Promise<PricingAgentCheckpoint> {
    this.logger.log(`Getting checkpoint: ${checkpointId} for agent: ${agentId} for tenant: ${tenantId}`);

    try {
      // Validate agent exists
      const agent = await this.pricingAgentService.findOnePricingAgent(agentId, tenantId);
      if (!agent) {
        this.logger.warn(`Pricing agent not found: ${agentId} for tenant: ${tenantId}`);
        throw new HttpException('Pricing agent not found', HttpStatus.NOT_FOUND);
      }

      const checkpoint = await this.pricingAgentService.findOneCheckpoint(checkpointId, tenantId);
      if (!checkpoint) {
        this.logger.warn(`Checkpoint not found: ${checkpointId} for tenant: ${tenantId}`);
        throw new HttpException('Checkpoint not found', HttpStatus.NOT_FOUND);
      }

      // Verify the checkpoint belongs to the specified agent
      if (checkpoint.pricingAgentId.toString() !== agentId) {
        this.logger.warn(`Checkpoint ${checkpointId} does not belong to agent ${agentId}`);
        throw new HttpException('Checkpoint does not belong to the specified agent', HttpStatus.NOT_FOUND);
      }

      this.logger.log(`Successfully retrieved checkpoint: ${checkpointId} for agent: ${agentId}`);
      return checkpoint;
    } catch (error) {
      this.logger.error(`Failed to get checkpoint ${checkpointId} for agent ${agentId}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to get checkpoint: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('/:agentId/datasets/build/')
  @ApiOperation({ summary: 'AI generate testing dataset' })
  @ApiParam({ name: 'agentId', description: 'Pricing agent ID' })
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant ID', required: false })
  @ApiQuery({ name: 'checkpointId', description: 'Checkpoint ID (optional, uses latest if not provided)', required: false })
  @ApiResponse({ status: 200, description: 'Dataset generated successfully', type: TestingDatasetWithTestsDto })
  @ApiResponse({ status: 404, description: 'Pricing agent or checkpoint not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async aiGenerateDataset(
    @Param('agentId') agentId: string,
    @Headers('X-Tenant-ID') tenantId?: string,
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

      const agent = await this.pricingAgentService.findOnePricingAgent(agentId, tenantId);
      if (!agent) {
        this.logger.warn(`Pricing agent not found for tests build: ${agentId}`);
        throw new HttpException('Pricing agent not found', HttpStatus.NOT_FOUND);
      }

      const result = await this.testingDatasetService.aiGenerateDataset(checkpoint, agent.name, tenantId);

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

  @Post('/:agentId/datasets/:datasetId')
  @ApiOperation({ summary: 'Assign a testing dataset to a pricing agent checkpoint' })
  @ApiParam({ name: 'agentId', description: 'Pricing agent ID' })
  @ApiParam({ name: 'datasetId', description: 'Testing dataset ID' })
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant ID', required: false })
  @ApiResponse({ status: 200, description: 'Testing dataset assigned successfully', type: AssignmentResultDto })
  @ApiResponse({ status: 400, description: 'Bad request - dataset already assigned or invalid parameters' })
  @ApiResponse({ status: 404, description: 'Pricing agent, checkpoint, or dataset not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async assignTestingDataset(
    @Param('agentId') agentId: string,
    @Param('datasetId') datasetId: string,
    @Headers('X-Tenant-ID') tenantId?: string
  ): Promise<AssignmentResultDto> {
    this.logger.log(`Assigning testing dataset: ${datasetId} for agent: ${agentId} for tenant: ${tenantId}`);

    try {
      // Validate agent exists
      const agent = await this.pricingAgentService.findOnePricingAgent(agentId, tenantId);
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

  @Delete('/:agentId/datasets/:datasetId')
  @ApiOperation({ summary: 'Unassign a testing dataset from a pricing agent checkpoint' })
  @ApiParam({ name: 'agentId', description: 'Pricing agent ID' })
  @ApiParam({ name: 'datasetId', description: 'Testing dataset ID' })
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant ID', required: false })
  @ApiResponse({ status: 200, description: 'Testing dataset unassigned successfully', schema: { type: 'object', properties: { unassigned: { type: 'boolean' } } } })
  @ApiResponse({ status: 404, description: 'Pricing agent or dataset assignment not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async unassignTestingDataset(
    @Param('agentId') agentId: string,
    @Param('datasetId') datasetId: string,
    @Headers('X-Tenant-ID') tenantId?: string
  ): Promise<{ unassigned: boolean }> {
    this.logger.log(`Unassigning testing dataset: ${datasetId} from agent: ${agentId} for tenant: ${tenantId}`);

    try {
      // Validate agent exists
      const agent = await this.pricingAgentService.findOnePricingAgent(agentId, tenantId);
      if (!agent) {
        this.logger.warn(`Pricing agent not found: ${agentId} for tenant: ${tenantId}`);
        throw new HttpException('Pricing agent not found', HttpStatus.NOT_FOUND);
      }

      const unassigned = await this.testingDatasetService.unassignTestingDataset(agentId, datasetId, tenantId);

      if (!unassigned) {
        this.logger.warn(`Testing dataset assignment not found: dataset ${datasetId} for agent ${agentId}`);
        throw new HttpException('Testing dataset assignment not found', HttpStatus.NOT_FOUND);
      }

      this.logger.log(`Successfully unassigned testing dataset: ${datasetId} from agent: ${agentId}`);
      return { unassigned: true };
    } catch (error) {
      this.logger.error(`Failed to unassign testing dataset ${datasetId} from agent ${agentId}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to unassign testing dataset: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':agentId/schema-examples')
  @ApiOperation({ summary: 'Get example request bodies for agent endpoints' })
  @ApiParam({ name: 'agentId', description: 'Pricing agent ID' })
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant ID', required: false })
  @ApiResponse({ status: 200, description: 'Example request bodies generated successfully', type: ExampleRequestBodiesDto })
  @ApiResponse({ status: 404, description: 'Pricing agent or checkpoint not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getExampleRequestBodies(
    @Param('agentId') agentId: string,
    @Headers('X-Tenant-ID') tenantId?: string,
  ): Promise<ExampleRequestBodiesDto> {
    try {
      this.logger.log(`Getting example request bodies for agent: ${agentId}`);

      // Find the latest deployed checkpoint for the agent
      const agent = await this.pricingAgentService.findOnePricingAgent(agentId, tenantId);
      if (!agent) {
        throw new HttpException('Pricing agent not found', HttpStatus.NOT_FOUND);
      }

      const checkpoint = await this.pricingAgentService.findLatestCheckpoint(agentId, tenantId);
      if (!checkpoint) {
        throw new HttpException('No checkpoint found for the specified agent', HttpStatus.NOT_FOUND);
      }

      // Create pricing agent context from agent name
      const pricingAgentContext = `${agent.name} pricing agent for generating quotes and pricing calculations`;

      // Generate example data from the schema using AI agents
      const calculatePriceExample = await this.exampleGeneratorService.generateExampleFromSchema(
        pricingAgentContext,
        checkpoint.functionSchema!,
        checkpoint.functionCode!,
        tenantId
      );
      const chatConversationExample = await this.exampleGeneratorService.generateChatExample(
        pricingAgentContext,
        checkpoint.functionSchema!,
        checkpoint.functionCode!,
        tenantId
      );

      this.logger.log(`Successfully generated example request bodies for agent: ${agentId}`);
      return {
        calculatePrice: calculatePriceExample,
        chatConversation: chatConversationExample
      };
    } catch (error) {
      this.logger.error(`Failed to get example request bodies: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(`Internal server error: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
