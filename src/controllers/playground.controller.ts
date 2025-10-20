import { Controller, Post, Param, Body, Query, Headers, HttpException, HttpStatus, Logger, Inject, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiHeader, ApiResponse } from '@nestjs/swagger';
import { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import { AiOrderConversionAgentService } from '../ai-agents/ai-order-conversion.agent';
import { AiPlaygroundMessageAgentService } from '../ai-agents/ai-playground-message.agent';
import { AiDemoConversationAgentService } from '../ai-agents/ai-demo-conversation.agent';
import { DynamicRunnerService } from '../services/dynamic-runner.service';
import { PlaygroundExecutionRequestDto, PlaygroundExecutionResponseDto, DemoConversationResponseDto } from '../dtos/playground-execution.dto';
import { AuthGuard } from '../auth/auth.guard';

@ApiTags('playground')
@Controller('playground')
@UseGuards(AuthGuard)
export class PlaygroundController {
  private readonly logger = new Logger(PlaygroundController.name);

  constructor(
    @Inject('DATABASE_CONNECTION') private db: Db,
    private readonly aiOrderConversionAgent: AiOrderConversionAgentService,
    private readonly aiPlaygroundMessageAgent: AiPlaygroundMessageAgentService,
    private readonly aiDemoConversationAgent: AiDemoConversationAgentService,
    private readonly dynamicRunnerService: DynamicRunnerService,
  ) {
    this.logger.log('PlaygroundController initialized');
  }

  private get checkpointCollection() {
    return this.db.collection('pricing-agent-checkpoints');
  }

  // Playground execution endpoint - conversation to parameters conversion, function execution, AI message generation
  @Post('pricing-agents/:agentId/playground')
  @ApiOperation({ summary: 'Execute agent with natural language input for playground testing' })
  @ApiParam({ name: 'agentId', description: 'Pricing agent ID' })
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant ID', required: false })
  @ApiQuery({ name: 'checkpointId', description: 'Checkpoint ID (optional, uses latest if not provided)', required: false })
  @ApiResponse({ status: 200, description: 'Agent executed successfully', type: PlaygroundExecutionResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request - invalid input' })
  @ApiResponse({ status: 404, description: 'Pricing agent or checkpoint not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async executePlayground(
    @Param('agentId') agentId: string,
    @Body() body: PlaygroundExecutionRequestDto,
    @Headers('X-Tenant-ID') tenantId?: string,
    @Query('checkpointId') checkpointId?: string
  ): Promise<PlaygroundExecutionResponseDto> {
    try {
      this.logger.log(`Executing playground for agent: ${agentId} with input: ${body.input?.substring(0, 100)}...`);

      // Find the checkpoint
      let checkpoint;
      if (checkpointId) {
        checkpoint = await this.checkpointCollection.findOne({
          _id: new ObjectId(checkpointId),
          pricingAgentId: new ObjectId(agentId),
          tenantId: tenantId || '',
          deletedAt: null
        });
      } else {
        // Get latest checkpoint
        const checkpoints = await this.checkpointCollection.find({
          pricingAgentId: new ObjectId(agentId),
          tenantId: tenantId || '',
          deletedAt: null
        }).sort({ version: -1 }).limit(1).toArray();
        checkpoint = checkpoints[0];
      }

      if (!checkpoint) {
        throw new HttpException('Pricing agent checkpoint not found', HttpStatus.NOT_FOUND);
      }

      if (!checkpoint.functionSchema || !checkpoint.functionCode) {
        throw new HttpException('Checkpoint must have both functionSchema and functionCode', HttpStatus.BAD_REQUEST);
      }

      // Step 1: Convert conversation to structured parameters
      const conversationHistory = (body.conversation || []).map(msg => ({
        message: msg.message,
        role: msg.role
      }));

      const conversionResult = await this.aiOrderConversionAgent.convertOrder({
        conversationHistory: conversationHistory,
        newUserMessage: body.input,
        schema: checkpoint.functionSchema
      });

      // Step 2: Execute the pricing function (without testing)
      const functionResult = await this.dynamicRunnerService.executePricingFunction(
        checkpoint.functionCode,
        checkpoint.functionSchema,
        conversionResult.structuredOrderInput
      );

      // Step 3: Generate AI message based on conversation and function result
      const conversation = body.conversation || [];

      const pricingAgentContext = checkpoint.humanInputMessages
        .map(msg => msg.message)
        .filter(msg => msg)
        .join('\n');

      const messageResult = await this.aiPlaygroundMessageAgent.generatePlaygroundMessage({
        conversation: conversation,
        functionResult: functionResult,
        pricingAgentContext: pricingAgentContext
      });

      return {
        structuredOrder: conversionResult.structuredOrderInput,
        functionResult: functionResult,
        aiMessage: messageResult.aiMessage
      };

    } catch (error) {
      this.logger.error(`Failed to execute playground: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(`Internal server error: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Demo conversation generation endpoint
  @Post('pricing-agents/:agentId/demo-conversation')
  @ApiOperation({ summary: 'Generate a demo conversation for the pricing agent' })
  @ApiParam({ name: 'agentId', description: 'Pricing agent ID' })
  @ApiHeader({ name: 'X-Tenant-ID', description: 'Tenant ID', required: false })
  @ApiQuery({ name: 'checkpointId', description: 'Checkpoint ID (optional, uses latest if not provided)', required: false })
  @ApiResponse({ status: 200, description: 'Demo conversation generated successfully', type: DemoConversationResponseDto })
  @ApiResponse({ status: 404, description: 'Pricing agent or checkpoint not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async generateDemoConversation(
    @Param('agentId') agentId: string,
    @Headers('X-Tenant-ID') tenantId?: string,
    @Query('checkpointId') checkpointId?: string
  ): Promise<DemoConversationResponseDto> {
    try {
      this.logger.log(`Generating demo conversation for agent: ${agentId}`);

      // Find the checkpoint
      let checkpoint;
      if (checkpointId) {
        checkpoint = await this.checkpointCollection.findOne({
          _id: new ObjectId(checkpointId),
          pricingAgentId: new ObjectId(agentId),
          tenantId: tenantId || '',
          deletedAt: null
        });
      } else {
        // Get latest checkpoint
        const checkpoints = await this.checkpointCollection.find({
          pricingAgentId: new ObjectId(agentId),
          tenantId: tenantId || '',
          deletedAt: null
        }).sort({ version: -1 }).limit(1).toArray();
        checkpoint = checkpoints[0];
      }

      if (!checkpoint) {
        throw new HttpException('Pricing agent checkpoint not found', HttpStatus.NOT_FOUND);
      }

      if (!checkpoint.functionSchema || !checkpoint.functionCode) {
        throw new HttpException('Checkpoint must have both functionSchema and functionCode', HttpStatus.BAD_REQUEST);
      }

      // Generate pricing agent context
      const pricingAgentContext = checkpoint.humanInputMessages
        .map(msg => msg.message)
        .filter(msg => msg)
        .join('\n');

      // Generate demo conversation
      const demoResult = await this.aiDemoConversationAgent.generateDemoConversation({
        pricingAgentContext: pricingAgentContext,
        functionSchema: checkpoint.functionSchema,
        functionCode: checkpoint.functionCode
      });

      return {
        conversationHistory: demoResult.conversationHistory,
        nextUserMessage: demoResult.nextUserMessage
      };

    } catch (error) {
      this.logger.error(`Failed to generate demo conversation: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(`Internal server error: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
