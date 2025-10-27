import { Controller, Post, Body, Param, Req, Inject, HttpException, HttpStatus, Logger, UseGuards, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiQuery, ApiParam } from '@nestjs/swagger';
import { Db } from 'mongodb';
import { AiMessageToSchemaConversionAgentService } from '../ai-agents/ai-message-to-schema-conversion.agent';
import { NaturalLanguageResponseGenerationAgentService } from '../ai-agents/ai-natural-language-response-generation.agent';
import { DynamicRunnerService } from '../services/dynamic-runner.service';
import { PricingAgentService } from '../services/pricing-agent.service';
import { ApiTokenGuard } from '../auth/api-token.guard';
import { PlaygroundExecutionRequestDto, PlaygroundExecutionResponseDto } from '../dtos/playground-execution.dto';
import { QuoteResultDTO } from '../dtos/checkpoint-testset.dto';
import { LangchainCongigService } from 'src/ai-agents/langchain-config.service';
import { OpenApiGeneratorService, OpenApiSpec } from 'src/services/openapi-generator.service';
import type { AuthenticatedRequest } from '../auth/auth.guard';

@ApiTags('integrations')
@Controller('integrations')
@UseGuards(ApiTokenGuard)
export class IntegrationsController {
  private readonly logger = new Logger(IntegrationsController.name);

  constructor(
    @Inject('DATABASE_CONNECTION') private db: Db,
    private readonly aiOrderConversionAgent: AiMessageToSchemaConversionAgentService,
    private readonly aiPlaygroundMessageAgent: NaturalLanguageResponseGenerationAgentService,
    private readonly dynamicRunnerService: DynamicRunnerService,
    private readonly pricingAgentService: PricingAgentService,
    private readonly llmService: LangchainCongigService,
    private readonly openApiGeneratorService: OpenApiGeneratorService,
  ) {
    this.logger.log('IntegrationsController initialized');
  }
  
  // Endpoint 1: Accept generated agent schema in body parameters, return calculated price
  @Post(':agentId/price')
  @ApiOperation({ summary: 'Calculate price using agent schema parameters' })
  @ApiQuery({ name: 'apiKey', description: 'API key', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Price calculated successfully', type: QuoteResultDTO })
  @ApiResponse({ status: 400, description: 'Bad request - invalid parameters or agent not deployed' })
  @ApiResponse({ status: 404, description: 'Pricing agent or checkpoint not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async calculatePrice(
    @Param('agentId') agentId: string,
    @Body() body: any, // The generated schema parameters
    @Req() request: AuthenticatedRequest
  ): Promise<QuoteResultDTO> {
    try {
      this.logger.log(`Calculating price for agent: ${agentId}`);
      if (!request.user?.id)
        throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);

      // Get the tenant ID from the authenticated API token
      const tenantId = request.user.tenantId;

      // Find the latest deployed checkpoint for the agent
      const agent = await this.pricingAgentService.findOnePricingAgent(agentId, tenantId);
      if (!agent) {
        throw new HttpException('Pricing agent not found', HttpStatus.NOT_FOUND);
      }

      if (!agent.isDeployed) {
        throw new HttpException('Pricing agent is not deployed', HttpStatus.BAD_REQUEST);
      }

      const checkpoint = await this.pricingAgentService.findLatestCheckpoint(agentId, tenantId);
      if (!checkpoint) {
        throw new HttpException('No checkpoint found for the specified agent', HttpStatus.NOT_FOUND);
      }

      if (!checkpoint.functionSchema || !checkpoint.functionCode) {
        throw new HttpException('Checkpoint must have both functionSchema and functionCode', HttpStatus.BAD_REQUEST);
      }

      // Execute the pricing function directly with the provided parameters
      const functionResult = await this.dynamicRunnerService.executePricingFunction(
        checkpoint.functionCode,
        checkpoint.functionSchema,
        body // Use the body directly as structured parameters
      );

      this.logger.log(`Successfully calculated price for agent: ${agentId}`);
      return functionResult;
    } catch (error) {
      this.logger.error(`Failed to calculate price: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(`Internal server error: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Endpoint 2: Accept human language conversation and act like playground
  @Post(':agentId/chat')
  @ApiOperation({ summary: 'Process human language conversation for pricing calculation' })
  @ApiQuery({ name: 'apiKey', description: 'API key', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Conversation processed successfully', type: PlaygroundExecutionResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request - invalid input or agent not deployed' })
  @ApiResponse({ status: 404, description: 'Pricing agent or checkpoint not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async processConversation(
    @Param('agentId') agentId: string,
    @Body() body: PlaygroundExecutionRequestDto,
    @Req() request: AuthenticatedRequest
  ): Promise<PlaygroundExecutionResponseDto> {
    try {
      this.logger.log(`Processing conversation for agent: ${agentId} with input: ${body.input?.substring(0, 100)}...`);
      if (!request.user?.id)
            throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);

      // Get the tenant ID from the authenticated API token
      const tenantId = request.user.tenantId;

      // Find the latest deployed checkpoint for the agent
      const agent = await this.pricingAgentService.findOnePricingAgent(agentId, tenantId);
      if (!agent) {
        throw new HttpException('Pricing agent not found', HttpStatus.NOT_FOUND);
      }

      if (!agent.isDeployed) {
        throw new HttpException('Pricing agent is not deployed', HttpStatus.BAD_REQUEST);
      }

      const checkpoint = await this.pricingAgentService.findLatestCheckpoint(agentId, tenantId);
      if (!checkpoint) {
        throw new HttpException('No checkpoint found for the specified agent', HttpStatus.NOT_FOUND);
      }

      if (!checkpoint.functionSchema || !checkpoint.functionCode) {
        throw new HttpException('Checkpoint must have both functionSchema and functionCode', HttpStatus.BAD_REQUEST);
      }

      // Step 1: Convert conversation to structured parameters
      const conversationHistory = (body.conversation || []).map(msg => ({
        message: msg.message,
        role: msg.role
      }));

        // Get tenant LLM config (will throw error for free tier tenants without BYOK)
      const llmConfig = await this.llmService.getTenantLLMConfig(tenantId);
      
      const conversionResult = await this.aiOrderConversionAgent.convertOrder({
        conversationHistory: conversationHistory,
        newUserMessage: body.input,
        schema: checkpoint.functionSchema
      }, llmConfig);

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
      }, llmConfig);

      return {
        structuredOrder: conversionResult.structuredOrderInput,
        functionResult: functionResult,
        aiMessage: messageResult.aiMessage
      };

    } catch (error) {
      this.logger.error(`Failed to process conversation: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(`Internal server error: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':agentId/openapi')
  @ApiParam({ name: 'agentId', description: 'Pricing agent ID' })
  @ApiOperation({ summary: 'Generate OpenAPI schema for the agent\'s pricing endpoint' })
  @ApiQuery({ name: 'apiKey', description: 'API key', required: true, type: String })
  @ApiResponse({ status: 200, description: 'OpenAPI schema generated successfully', type: Object })
  @ApiResponse({ status: 404, description: 'Pricing agent or checkpoint not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getAgentOpenApiSchema(
    @Param('agentId') agentId: string,
    @Req() request: AuthenticatedRequest
  ): Promise<OpenApiSpec> {
    try {
      if (!request.user?.id)
        throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);

      // Get the tenant ID from the authenticated API token
      const tenantId = request.user.tenantId;

      // Find the latest deployed checkpoint for the agent
      const agent = await this.pricingAgentService.findOnePricingAgent(agentId, tenantId);
      if (!agent) {
        throw new HttpException('Pricing agent not found', HttpStatus.NOT_FOUND);
      }

      if (!agent.isDeployed) {
        throw new HttpException('Pricing agent is not deployed', HttpStatus.BAD_REQUEST);
      }

      const checkpoint = await this.pricingAgentService.findLatestCheckpoint(agentId, tenantId);
      if (!checkpoint) {
        this.logger.warn(`Checkpoint not found for tests build: ${agentId}`);
        throw new HttpException('Checkpoint not found', HttpStatus.NOT_FOUND);
      }

      if (!checkpoint.functionSchema) {
        throw new HttpException('Checkpoint must have functionSchema', HttpStatus.BAD_REQUEST);
      }

      // Generate OpenAPI schema from the TypeScript interface
      const openApiSpec = await this.openApiGeneratorService.generateOrderOpenApiSchema(
        checkpoint.functionSchema
      );

      this.logger.log(`Successfully generated OpenAPI schema for agent: ${agentId}`);
      return openApiSpec;
    } catch (error) {
      this.logger.error(`Failed to generate OpenAPI schema: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(`Internal server error: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
