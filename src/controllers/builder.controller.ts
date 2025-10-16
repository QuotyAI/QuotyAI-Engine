import { Controller, Post, Get, Put, Delete, Body, Param, Query, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { PricingAgentService } from '../services/pricing-agent.service';
import { PricingAgent, PricingAgentCheckpoint } from '../models/mongodb.model';
import { PricingAgentWithLatestCheckpoint } from 'src/dtos/pricing-agent-with-latest-checkpoint.dto';
import { CreatePricingAgentDto } from '../dtos/create-pricing-agent.dto';
import { AddHumanInputMessageDto } from '../dtos/add-input-message.dto';
import { isMultiTenancyEnabled } from '../config/multi-tenancy.config';

@ApiTags('builder')
@Controller('builder')
export class BuilderController {
  private readonly logger = new Logger(BuilderController.name);

  constructor(
    private readonly pricingAgentService: PricingAgentService) {
    this.logger.log('BuilderController initialized');
  }

  // Pricing Agent CRUD endpoints
  @Post('pricing-agents')
  @ApiOperation({ summary: 'Create a new pricing agent' })
  @ApiQuery({ name: 'tenantId', description: 'Tenant ID (required in multi-tenant mode)', required: false })
  @ApiResponse({ status: 201, description: 'Pricing agent created successfully', type: PricingAgentWithLatestCheckpoint })
  @ApiResponse({ status: 400, description: 'Bad request - missing required parameters' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async createPricingAgent(
    @Body() body: CreatePricingAgentDto,
    @Query('tenantId') tenantId?: string
  ): Promise<PricingAgentWithLatestCheckpoint> {
    this.logger.log(`Creating pricing agent: ${body.name} for tenant: ${tenantId}`);

    try {
      if ((isMultiTenancyEnabled && !tenantId) || !body.name) {
        this.logger.warn(`Missing required parameters - tenantId: ${tenantId}, name: ${body.name}`);
        throw new HttpException(
          `${isMultiTenancyEnabled ? 'tenantId (query param) and ' : ''}name are required`,
          HttpStatus.BAD_REQUEST
        );
      }

      // Create the pricing agent first
      const pricingAgentData = {
        tenantId,
        name: body.name,
      };
      const pricingAgent = await this.pricingAgentService.create(pricingAgentData);
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
      const agentsWithCheckpoints = await this.pricingAgentService.findAllWithLatestCheckpoint(tenantId);
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

  @Get('pricing-agents')
  @ApiOperation({ summary: 'Get all pricing agents for a tenant' })
  @ApiQuery({ name: 'tenantId', description: 'Tenant ID (required in multi-tenant mode)', required: false })
  @ApiResponse({ status: 200, description: 'Pricing agents retrieved successfully', type: [PricingAgentWithLatestCheckpoint] })
  @ApiResponse({ status: 400, description: 'Bad request - tenantId required in multi-tenant mode' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getPricingAgents(@Query('tenantId') tenantId?: string): Promise<PricingAgentWithLatestCheckpoint[]> {
    this.logger.log(`Getting pricing agents for tenant: ${tenantId}`);

    try {
      if (isMultiTenancyEnabled && !tenantId) {
        this.logger.warn('tenantId is required in multi-tenant mode');
        throw new HttpException('tenantId is required in multi-tenant mode', HttpStatus.BAD_REQUEST);
      }

      const agents = await this.pricingAgentService.findAllWithLatestCheckpoint(tenantId);
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

  @Get('pricing-agents/:id')
  @ApiOperation({ summary: 'Get a specific pricing agent by ID' })
  @ApiParam({ name: 'id', description: 'Pricing agent ID' })
  @ApiQuery({ name: 'tenantId', description: 'Tenant ID (required in multi-tenant mode)', required: false })
  @ApiResponse({ status: 200, description: 'Pricing agent retrieved successfully', type: PricingAgent })
  @ApiResponse({ status: 400, description: 'Bad request - tenantId required in multi-tenant mode' })
  @ApiResponse({ status: 404, description: 'Pricing agent not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getPricingAgent(@Param('id') id: string, @Query('tenantId') tenantId?: string): Promise<PricingAgent> {
    this.logger.log(`Getting pricing agent: ${id} for tenant: ${tenantId}`);

    try {
      if (isMultiTenancyEnabled && !tenantId) {
        this.logger.warn('tenantId is required in multi-tenant mode');
        throw new HttpException('tenantId is required in multi-tenant mode', HttpStatus.BAD_REQUEST);
      }

      const agent = await this.pricingAgentService.findOne(id, tenantId);
      if (!agent) {
        this.logger.warn(`Pricing agent not found: ${id} for tenant: ${tenantId}`);
        throw new HttpException('Pricing agent not found', HttpStatus.NOT_FOUND);
      }
      this.logger.log(`Successfully retrieved pricing agent: ${agent.name} (${id})`);
      return agent;
    } catch (error) {
      this.logger.error(`Failed to get pricing agent ${id}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to get pricing agent: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Put('pricing-agents/:id')
  @ApiOperation({ summary: 'Update a pricing agent' })
  @ApiParam({ name: 'id', description: 'Pricing agent ID' })
  @ApiQuery({ name: 'tenantId', description: 'Tenant ID (required in multi-tenant mode)', required: false })
  @ApiResponse({ status: 200, description: 'Pricing agent updated successfully', type: PricingAgent })
  @ApiResponse({ status: 400, description: 'Bad request - tenantId required in multi-tenant mode' })
  @ApiResponse({ status: 404, description: 'Pricing agent not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async updatePricingAgent(
    @Param('id') id: string,
    @Body() body: Partial<Omit<PricingAgent, '_id' | 'createdAt'>>,
    @Query('tenantId') tenantId?: string
  ): Promise<PricingAgent> {
    this.logger.log(`Updating pricing agent: ${id} for tenant: ${tenantId}`);

    try {
      if (isMultiTenancyEnabled && !tenantId) {
        this.logger.warn('tenantId is required in multi-tenant mode');
        throw new HttpException('tenantId is required in multi-tenant mode', HttpStatus.BAD_REQUEST);
      }

      const agent = await this.pricingAgentService.update(id, body, tenantId);
      if (!agent) {
        this.logger.warn(`Pricing agent not found for update: ${id} for tenant: ${tenantId}`);
        throw new HttpException('Pricing agent not found', HttpStatus.NOT_FOUND);
      }
      this.logger.log(`Successfully updated pricing agent: ${agent.name} (${id})`);
      return agent;
    } catch (error) {
      this.logger.error(`Failed to update pricing agent ${id}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to update pricing agent: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete('pricing-agents/:id')
  @ApiOperation({ summary: 'Delete a pricing agent' })
  @ApiParam({ name: 'id', description: 'Pricing agent ID' })
  @ApiQuery({ name: 'tenantId', description: 'Tenant ID (required in multi-tenant mode)', required: false })
  @ApiResponse({ status: 200, description: 'Pricing agent deleted successfully', schema: { type: 'object', properties: { deleted: { type: 'boolean' } } } })
  @ApiResponse({ status: 400, description: 'Bad request - tenantId required in multi-tenant mode' })
  @ApiResponse({ status: 404, description: 'Pricing agent not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async deletePricingAgent(@Param('id') id: string, @Query('tenantId') tenantId?: string): Promise<{ deleted: boolean }> {
    this.logger.log(`Deleting pricing agent: ${id} for tenant: ${tenantId}`);

    try {
      if (isMultiTenancyEnabled && !tenantId) {
        this.logger.warn('tenantId is required in multi-tenant mode');
        throw new HttpException('tenantId is required in multi-tenant mode', HttpStatus.BAD_REQUEST);
      }

      const deleted = await this.pricingAgentService.delete(id, tenantId);
      if (!deleted) {
        this.logger.warn(`Pricing agent not found for deletion: ${id} for tenant: ${tenantId}`);
        throw new HttpException('Pricing agent not found', HttpStatus.NOT_FOUND);
      }
      this.logger.log(`Successfully deleted pricing agent: ${id}`);
      return { deleted: true };
    } catch (error) {
      this.logger.error(`Failed to delete pricing agent ${id}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to delete pricing agent: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('pricing-agents/:agentId/messages')
  @ApiOperation({ summary: 'Add input message to pricing agent' })
  @ApiParam({ name: 'agentId', description: 'Pricing agent ID' })
  @ApiQuery({ name: 'checkpointId', description: 'Checkpoint ID (optional, uses latest if not provided)', required: false })
  @ApiQuery({ name: 'tenantId', description: 'Tenant ID', required: false })
  @ApiResponse({ status: 200, description: 'Input message added successfully', type: PricingAgentCheckpoint })
  @ApiResponse({ status: 400, description: 'Bad request - no valid input provided' })
  @ApiResponse({ status: 404, description: 'Pricing agent or checkpoint not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async addInputMessage(
    @Param('agentId') agentId: string,
    @Body() body: AddHumanInputMessageDto,
    @Query('checkpointId') checkpointId?: string,
    @Query('tenantId') tenantId?: string
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

  @Delete('pricing-agents/:agentId/checkpoints/:checkpointId/messages/:messageId')
  @ApiOperation({ summary: 'Delete an input message from a checkpoint' })
  @ApiParam({ name: 'agentId', description: 'Pricing agent ID' })
  @ApiParam({ name: 'checkpointId', description: 'Checkpoint ID' })
  @ApiParam({ name: 'messageId', description: 'Message ID' })
  @ApiQuery({ name: 'tenantId', description: 'Tenant ID', required: false })
  @ApiResponse({ status: 200, description: 'Message deleted successfully', type: PricingAgentCheckpoint })
  @ApiResponse({ status: 404, description: 'Pricing agent, checkpoint, or message not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async deleteInputMessage(
    @Param('agentId') agentId: string,
    @Param('checkpointId') checkpointId: string,
    @Param('messageId') messageId: string,
    @Query('tenantId') tenantId?: string
  ): Promise<PricingAgentCheckpoint> {
    this.logger.log(`Deleting message: ${messageId} from checkpoint: ${checkpointId} for agent: ${agentId} for tenant: ${tenantId}`);

    try {
      // Validate agent exists
      const agent = await this.pricingAgentService.findOne(agentId, tenantId);
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

  @Post('pricing-agents/:agentId/build')
  @ApiOperation({ summary: 'Build a complete pricing agent with schema and formula' })
  @ApiParam({ name: 'agentId', description: 'Pricing agent ID' })
  @ApiQuery({ name: 'tenantId', description: 'Tenant ID', required: false })
  @ApiQuery({ name: 'checkpointId', description: 'Checkpoint ID (optional, uses latest if not provided)', required: false })
  @ApiResponse({ status: 200, description: 'Agent built successfully', type: PricingAgentCheckpoint })
  @ApiResponse({ status: 404, description: 'Pricing agent or checkpoint not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async buildAgent(
    @Param('agentId') agentId: string,
    @Query('tenantId') tenantId?: string,
    @Query('checkpointId') checkpointId?: string
  ): Promise<PricingAgentCheckpoint> {
    this.logger.log(`Building agent: ${agentId} for tenant: ${tenantId}`);

    try {
      // If checkpointId is not provided, get the latest checkpoint for the agent
      let targetCheckpointId = checkpointId;
      if (!targetCheckpointId) {
        const latestCheckpoint = await this.pricingAgentService.findLatestCheckpoint(agentId, tenantId);
        if (!latestCheckpoint) {
          this.logger.warn(`No checkpoint found for agent build: ${agentId} for tenant: ${tenantId}`);
          throw new HttpException('No checkpoint found for the specified agent', HttpStatus.NOT_FOUND);
        }
        targetCheckpointId = latestCheckpoint._id!.toString();
      }

      const checkpoint = await this.pricingAgentService.buildAgent(agentId, targetCheckpointId, tenantId);
      if (!checkpoint) {
        this.logger.warn(`Pricing agent or checkpoint not found for build: ${agentId}, checkpoint: ${targetCheckpointId}`);
        throw new HttpException('Pricing agent or checkpoint not found', HttpStatus.NOT_FOUND);
      }
      this.logger.log(`Successfully built agent: ${agentId}, checkpoint: ${checkpoint._id}`);
      return checkpoint;
    } catch (error) {
      this.logger.error(`Failed to build agent ${agentId}: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to build agent: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('pricing-agents/:agentId/build/schema')
  @ApiOperation({ summary: 'Build schema only for pricing agent' })
  @ApiParam({ name: 'agentId', description: 'Pricing agent ID' })
  @ApiQuery({ name: 'tenantId', description: 'Tenant ID', required: false })
  @ApiQuery({ name: 'checkpointId', description: 'Checkpoint ID (optional, uses latest if not provided)', required: false })
  @ApiResponse({ status: 200, description: 'Schema built successfully', schema: { type: 'object', properties: { functionSchema: { type: 'string' } } } })
  @ApiResponse({ status: 404, description: 'Pricing agent or checkpoint not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async buildSchema(
    @Param('agentId') agentId: string,
    @Query('tenantId') tenantId?: string,
    @Query('checkpointId') checkpointId?: string
  ): Promise<{functionSchema: string}> {
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

      const checkpoint = await this.pricingAgentService.buildSchemaOnly(agentId, targetCheckpointId, tenantId);
      if (!checkpoint) {
        this.logger.warn(`Pricing agent or checkpoint not found for schema build: ${agentId}, checkpoint: ${targetCheckpointId}`);
        throw new HttpException('Pricing agent or checkpoint not found', HttpStatus.NOT_FOUND);
      }
      this.logger.log(`Successfully built schema for agent: ${agentId}, checkpoint: ${checkpoint._id}`);
      return { functionSchema: checkpoint.functionSchema || '' };
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

  @Post('pricing-agents/:agentId/build/formula')
  @ApiOperation({ summary: 'Build formula only for pricing agent' })
  @ApiParam({ name: 'agentId', description: 'Pricing agent ID' })
  @ApiQuery({ name: 'tenantId', description: 'Tenant ID', required: false })
  @ApiQuery({ name: 'checkpointId', description: 'Checkpoint ID (optional, uses latest if not provided)', required: false })
  @ApiResponse({ status: 200, description: 'Formula built successfully', type: PricingAgentCheckpoint })
  @ApiResponse({ status: 404, description: 'Pricing agent or checkpoint not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async buildFormula(
    @Param('agentId') agentId: string,
    @Query('tenantId') tenantId?: string,
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

      const checkpoint = await this.pricingAgentService.buildFormulaOnly(agentId, targetCheckpointId, tenantId);
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

  @Get('pricing-agents/:agentId/checkpoints')
  @ApiOperation({ summary: 'Get latest checkpoints for a pricing agent' })
  @ApiParam({ name: 'agentId', description: 'Pricing agent ID' })
  @ApiQuery({ name: 'tenantId', description: 'Tenant ID', required: false })
  @ApiQuery({ name: 'limit', description: 'Maximum number of checkpoints to return (default: 50)', required: false })
  @ApiResponse({ status: 200, description: 'Checkpoints retrieved successfully', type: [PricingAgentCheckpoint] })
  @ApiResponse({ status: 404, description: 'Pricing agent not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getPricingAgentCheckpoints(
    @Param('agentId') agentId: string,
    @Query('tenantId') tenantId?: string,
    @Query('limit') limit?: string
  ): Promise<PricingAgentCheckpoint[]> {
    this.logger.log(`Getting latest checkpoints for agent: ${agentId} for tenant: ${tenantId}`);

    try {
      // Validate agent exists
      const agent = await this.pricingAgentService.findOne(agentId, tenantId);
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

  @Get('pricing-agents/:agentId/checkpoints/:checkpointId')
  @ApiOperation({ summary: 'Get full checkpoint data by ID' })
  @ApiParam({ name: 'agentId', description: 'Pricing agent ID' })
  @ApiParam({ name: 'checkpointId', description: 'Checkpoint ID' })
  @ApiQuery({ name: 'tenantId', description: 'Tenant ID', required: false })
  @ApiResponse({ status: 200, description: 'Checkpoint retrieved successfully', type: PricingAgentCheckpoint })
  @ApiResponse({ status: 404, description: 'Pricing agent or checkpoint not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getPricingAgentCheckpoint(
    @Param('agentId') agentId: string,
    @Param('checkpointId') checkpointId: string,
    @Query('tenantId') tenantId?: string
  ): Promise<PricingAgentCheckpoint> {
    this.logger.log(`Getting checkpoint: ${checkpointId} for agent: ${agentId} for tenant: ${tenantId}`);

    try {
      // Validate agent exists
      const agent = await this.pricingAgentService.findOne(agentId, tenantId);
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
}
