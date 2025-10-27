import { Injectable, Inject, Logger } from '@nestjs/common';
import { Db, ObjectId, Filter } from 'mongodb';
import { randomUUID } from 'crypto';
import {
  PricingAgentCheckpoint,
  HumanInputMessage,
  PricingAgent,
} from '../models/mongodb.model';
import { PricingAgentWithLatestCheckpoint } from 'src/dtos/pricing-agent-with-latest-checkpoint.dto';
import { AddHumanInputMessageDto } from '../dtos/add-input-message.dto';
import { AiSchemaGenerationAgentService } from '../ai-agents/ai-schema-generation.agent';
import { AiFormulaGenerationAgentService } from '../ai-agents/ai-formula-generation.agent';
import { LangchainCongigService } from '../ai-agents/langchain-config.service';

type PricingAgentFilter = Filter<PricingAgent>;
type CheckpointFilter = Filter<PricingAgentCheckpoint>;
type CheckpointMatchCondition = {
  pricingAgentId: { $in: ObjectId[] };
  deletedAt: null;
  tenantId?: string;
};
type CheckpointMap = Map<string, PricingAgentCheckpoint>;

/**
 * Core service for managing pricing agents, checkpoints, and AI-powered code generation.
 *
 * This service provides comprehensive CRUD operations for pricing agents and their
 * versioned checkpoints. It orchestrates the AI-powered generation of both TypeScript
 * schemas and pricing calculation functions, managing the complete lifecycle of
 * pricing agent development from initial creation through iterative refinement.
 *
 * Key responsibilities:
 * - Pricing agent lifecycle management (create, read, update, delete)
 * - Checkpoint versioning and history tracking
 * - AI schema generation from natural language descriptions
 * - AI function generation with business rule implementation
 * - Feedback-based regeneration for iterative improvement
 * - Multi-tenant data isolation and access control
 */
@Injectable()
export class PricingAgentService {
  private readonly logger = new Logger(PricingAgentService.name);

  constructor(
    @Inject('DATABASE_CONNECTION') private db: Db,
    private readonly aiSchemaGenerationAgent: AiSchemaGenerationAgentService,
    private readonly aiFormulaGenerationAgent: AiFormulaGenerationAgentService,
    private readonly llmService: LangchainCongigService,
  ) {
    this.logger.log('PricingAgentService initialized');
  }

  private get collection() {
    return this.db.collection<PricingAgent>('pricing-agents');
  }

  private get checkpointCollection() {
    return this.db.collection<PricingAgentCheckpoint>('pricing-agent-checkpoints');
  }

  private buildPricingAgentFilter(tenantId?: string, additionalFilters: Partial<PricingAgentFilter> = {}): PricingAgentFilter {
    const filter: PricingAgentFilter = { deletedAt: null, ...additionalFilters };
    if (tenantId) {
      filter.tenantId = tenantId;
    }
    return filter;
  }

  private buildCheckpointFilter(tenantId?: string, additionalFilters: Partial<CheckpointFilter> = {}): CheckpointFilter {
    const filter: CheckpointFilter = { deletedAt: null, ...additionalFilters };
    if (tenantId) {
      filter.tenantId = tenantId;
    }
    return filter;
  }

  private extractPricingDescriptionFromHumanMessages(checkpoint: PricingAgentCheckpoint): string {
    return checkpoint.humanInputMessages
      .map(msg => msg.message || '')
      .filter(msg => msg.trim())
      .join('\n');
  }

  async createPricingAgent(pricingAgent: Omit<PricingAgent, '_id' | 'createdAt'>): Promise<PricingAgent> {
    this.logger.log(`Creating pricing agent: ${pricingAgent.name} for tenant: ${pricingAgent.tenantId}`);

    try {
      const now = new Date();
      const doc = {
        ...pricingAgent,
        createdAt: now,
      };
      const result = await this.collection.insertOne(doc);

      const createdAgent = {
        _id: result.insertedId,
        ...doc,
      };

      this.logger.log(`Successfully created pricing agent with ID: ${createdAgent._id}`);
      return createdAgent;
    } catch (error) {
      this.logger.error(`Failed to create pricing agent: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findAllPricingAgents(tenantId?: string): Promise<PricingAgent[]> {
    this.logger.log(`Finding all pricing agents for tenant: ${tenantId}`);

    try {
      const filter = this.buildPricingAgentFilter(tenantId);
      const agents = await this.collection.find(filter).toArray();

      this.logger.log(`Successfully retrieved ${agents.length} pricing agents for tenant: ${tenantId}`);
      return agents;
    } catch (error) {
      this.logger.error(`Failed to find all pricing agents: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findAllPricingAgentsWithLatestCheckpoint(tenantId?: string): Promise<PricingAgentWithLatestCheckpoint[]> {
    this.logger.log(`Finding all pricing agents with latest checkpoints for tenant: ${tenantId}`);

    try {
      const filter = this.buildPricingAgentFilter(tenantId);
      const agents = await this.collection.find(filter).toArray();

      if (agents.length === 0) {
        this.logger.log(`No pricing agents found for tenant: ${tenantId}`);
        return [];
      }

      // Collect all agent IDs
      const agentIds = agents.map(agent => agent._id!);

      // Fetch latest checkpoints for all agents in a single query
      const matchCondition: CheckpointMatchCondition = {
        pricingAgentId: { $in: agentIds },
        deletedAt: null
      };
      if (tenantId) {
        matchCondition.tenantId = tenantId;
      }

      const latestCheckpoints = await this.db.collection('pricing-agent-checkpoints')
        .aggregate([
          {
            $match: matchCondition
          },
          {
            $sort: { version: -1 }
          },
          {
            $group: {
              _id: '$pricingAgentId',
              latestCheckpoint: { $first: '$$ROOT' }
            }
          }
        ])
        .toArray();

      // Create a map for quick lookup of checkpoints by agent ID
      const checkpointMap: CheckpointMap = new Map();
      latestCheckpoints.forEach(item => {
        checkpointMap.set(item._id.toString(), item.latestCheckpoint);
      });

      // Combine agents with their latest checkpoints
      const agentsWithCheckpoints: PricingAgentWithLatestCheckpoint[] = agents.map(agent => ({
        ...agent,
        latestCheckpoint: checkpointMap.get(agent._id!.toString()) || null,
      }));

      this.logger.log(`Successfully retrieved ${agentsWithCheckpoints.length} pricing agents with checkpoints for tenant: ${tenantId}`);
      return agentsWithCheckpoints;
    } catch (error) {
      this.logger.error(`Failed to find all pricing agents with latest checkpoints: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findOnePricingAgent(id: string, tenantId?: string): Promise<PricingAgent | null> {
    this.logger.log(`Finding pricing agent: ${id} for tenant: ${tenantId}`);

    try {
      const filter = this.buildPricingAgentFilter(tenantId, { _id: new ObjectId(id) });
      const agent = await this.collection.findOne(filter);

      if (agent) {
        this.logger.log(`Successfully found pricing agent: ${agent.name} (${id})`);
      } else {
        this.logger.warn(`Pricing agent not found: ${id} for tenant: ${tenantId}`);
      }

      return agent;
    } catch (error) {
      this.logger.error(`Failed to find pricing agent ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updatePricingAgent(id: string, updateData: Partial<Omit<PricingAgent, '_id' | 'createdAt'>>, tenantId?: string): Promise<PricingAgent | null> {
    this.logger.log(`Updating pricing agent: ${id} for tenant: ${tenantId}`);

    try {
      const filter = this.buildPricingAgentFilter(tenantId, { _id: new ObjectId(id) });
      await this.collection.updateOne(filter, { $set: updateData });
      const updatedAgent = await this.findOnePricingAgent(id, tenantId);

      if (updatedAgent) {
        this.logger.log(`Successfully updated pricing agent: ${updatedAgent.name} (${id})`);
      } else {
        this.logger.warn(`Pricing agent not found after update: ${id} for tenant: ${tenantId}`);
      }

      return updatedAgent;
    } catch (error) {
      this.logger.error(`Failed to update pricing agent ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deletePricingAgent(id: string, tenantId?: string): Promise<boolean> {
    this.logger.log(`Soft deleting pricing agent: ${id} for tenant: ${tenantId}`);

    try {
      const filter = this.buildPricingAgentFilter(tenantId, { _id: new ObjectId(id) });
      const result = await this.collection.updateOne(filter, { $set: { deletedAt: new Date() } });
      const deleted = result.modifiedCount > 0;

      if (deleted) {
        this.logger.log(`Successfully soft deleted pricing agent: ${id}`);
      } else {
        this.logger.warn(`Pricing agent not found for deletion: ${id} for tenant: ${tenantId}`);
      }

      return deleted;
    } catch (error) {
      this.logger.error(`Failed to soft delete pricing agent ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Checkpoint methods
  async createCheckpoint(checkpoint: Omit<PricingAgentCheckpoint, '_id' | 'createdAt'>): Promise<PricingAgentCheckpoint> {
    const now = new Date();
    const doc = {
      ...checkpoint,
      createdAt: now,
    };
    const result = await this.checkpointCollection.insertOne(doc);
    return {
      _id: result.insertedId,
      ...doc,
    };
  }

  async findAllCheckpoints(pricingAgentId?: string, tenantId?: string): Promise<PricingAgentCheckpoint[]> {
    const additionalFilters: Partial<CheckpointFilter> = {};
    if (pricingAgentId) {
      additionalFilters.pricingAgentId = new ObjectId(pricingAgentId);
    }
    const filter = this.buildCheckpointFilter(tenantId, additionalFilters);
    return this.checkpointCollection.find(filter).sort({ version: 1 }).toArray();
  }

  async findLatestCheckpoints(pricingAgentId: string, tenantId?: string, limit: number = 50): Promise<PricingAgentCheckpoint[]> {
    this.logger.log(`Finding latest ${limit} checkpoints for agent: ${pricingAgentId} for tenant: ${tenantId}`);

    try {
      const filter = this.buildCheckpointFilter(tenantId, { pricingAgentId: new ObjectId(pricingAgentId) });
      const checkpoints = await this.checkpointCollection.find(filter).sort({ version: -1 }).limit(limit).toArray();

      this.logger.log(`Successfully retrieved ${checkpoints.length} latest checkpoints for agent: ${pricingAgentId}`);
      return checkpoints;
    } catch (error) {
      this.logger.error(`Failed to find latest checkpoints for agent ${pricingAgentId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findOneCheckpoint(id: string, tenantId?: string): Promise<PricingAgentCheckpoint | null> {
    const filter = this.buildCheckpointFilter(tenantId, { _id: new ObjectId(id) });
    return this.checkpointCollection.findOne(filter);
  }

  async findLatestCheckpoint(pricingAgentId: string, tenantId?: string): Promise<PricingAgentCheckpoint | null> {
    const filter = this.buildCheckpointFilter(tenantId, { pricingAgentId: new ObjectId(pricingAgentId) });
    return this.checkpointCollection.find(filter).sort({ version: -1 }).limit(1).toArray().then(checkpoints => checkpoints[0] || null);
  }

  async updateCheckpoint(id: string, updateData: Partial<Omit<PricingAgentCheckpoint, '_id' | 'createdAt'>>, tenantId?: string): Promise<PricingAgentCheckpoint | null> {
    const filter = this.buildCheckpointFilter(tenantId, { _id: new ObjectId(id) });
    await this.checkpointCollection.updateOne(filter, { $set: updateData });
    return this.findOneCheckpoint(id, tenantId);
  }

  async deleteCheckpoint(id: string, tenantId?: string): Promise<boolean> {
    const filter = this.buildCheckpointFilter(tenantId, { _id: new ObjectId(id) });
    const result = await this.checkpointCollection.deleteOne(filter);
    return result.deletedCount > 0;
  }

  async addInputMessage(pricingAgentId: string, checkpointId: string, messageData: AddHumanInputMessageDto, tenantId?: string): Promise<PricingAgentCheckpoint | null> {
    const sourceCheckpoint = await this.findOneCheckpoint(checkpointId, tenantId);
    if (!sourceCheckpoint) {
      return null; // Checkpoint not found
    }

    // Create new checkpoint as full clone of the specified checkpoint
    const newCheckpoint: PricingAgentCheckpoint = {
      ...sourceCheckpoint,
      _id: undefined, // Will be set by MongoDB
      humanInputMessages: [...sourceCheckpoint.humanInputMessages] as HumanInputMessage[], // Clone the array
      functionSchema: '',
      functionCode: '',
      checkpointTrigger: 'input_message_added',
      createdAt: new Date(),
      checkpointDescription: `Added new input message: ${messageData.message || (messageData.tags && messageData.tags.join(', ')) || 'no content'}`,
    };

    // Add the new message to inputMessages
    const newMessage: HumanInputMessage = {
      ...messageData,
      id: randomUUID(),
      createdAt: new Date(),
    };
    newCheckpoint.humanInputMessages.push(newMessage);

    return this.createCheckpoint(newCheckpoint);
  }

  async deleteInputMessage(pricingAgentId: string, checkpointId: string, messageId: string, tenantId?: string): Promise<PricingAgentCheckpoint | null> {
    const sourceCheckpoint = await this.findOneCheckpoint(checkpointId, tenantId);
    if (!sourceCheckpoint) {
      return null; // Checkpoint not found
    }

    // Find the message to delete
    const messageIndex = sourceCheckpoint.humanInputMessages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) {
      throw new Error('Message not found in checkpoint');
    }

    const messageToDelete = sourceCheckpoint.humanInputMessages[messageIndex];

    // Create new checkpoint as full clone of the specified checkpoint
    const newCheckpoint: PricingAgentCheckpoint = {
      ...sourceCheckpoint,
      _id: undefined, // Will be set by MongoDB
      humanInputMessages: [...sourceCheckpoint.humanInputMessages] as HumanInputMessage[], // Clone the array
      checkpointTrigger: 'input_message_deleted',
      createdAt: new Date(),
      checkpointDescription: `Deleted input message: ${messageToDelete.message}`,
    };

    // Remove the message from inputMessages
    newCheckpoint.humanInputMessages.splice(messageIndex, 1);

    return this.createCheckpoint(newCheckpoint);
  }

  async buildSchemaOnly(pricingAgentId: string, checkpointId: string, feedback?: string, tenantId?: string): Promise<PricingAgentCheckpoint | null> {
    const sourceCheckpoint = await this.findOneCheckpoint(checkpointId, tenantId);
    if (!sourceCheckpoint) {
      return null; // Checkpoint not found
    }

    const pricingDescription = this.extractPricingDescriptionFromHumanMessages(sourceCheckpoint);

    if (!pricingDescription.trim()) {
      throw new Error('No input messages found to generate schema');
    }

    // Get tenant LLM config (will throw error for free tier tenants without BYOK)
    const llmConfig = await this.llmService.getTenantLLMConfig(tenantId);

    // Generate only schema
    const schemaResult = await this.aiSchemaGenerationAgent.generateInputTypes({
      inputMessage: pricingDescription,
      feedback: feedback,
      currentSchema: sourceCheckpoint.functionSchema || undefined,
    }, llmConfig);

    // Create new checkpoint with generated schema
    const newCheckpoint: PricingAgentCheckpoint = {
      ...sourceCheckpoint,
      _id: undefined, // Will be set by MongoDB
      functionSchema: schemaResult.code,
      functionCode: '', // Clear function code for new schema generation
      checkpointTrigger: 'function_order_schema_updated',
      createdAt: new Date(),
      checkpointDescription: feedback ? `Schema regenerated with feedback: ${feedback}` : 'Schema generated',
    };

    return this.createCheckpoint(newCheckpoint);
  }

  async buildFormulaOnly(pricingAgentId: string, checkpointId: string, feedback?: string, tenantId?: string): Promise<PricingAgentCheckpoint | null> {
    const sourceCheckpoint = await this.findOneCheckpoint(checkpointId, tenantId);
    if (!sourceCheckpoint) {
      return null; // Checkpoint not found
    }

    const pricingDescription = this.extractPricingDescriptionFromHumanMessages(sourceCheckpoint);

    if (!pricingDescription.trim()) {
      throw new Error('No input messages found to generate function');
    }

    // Get tenant LLM config (will throw error for free tier tenants without BYOK)
    const llmConfig = await this.llmService.getTenantLLMConfig(tenantId);

    // Generate only function
    const functionResult = await this.aiFormulaGenerationAgent.generatePricingFunction({
      pricingDescription: pricingDescription,
      schema: sourceCheckpoint.functionSchema || '',
      feedback: feedback,
      currentFunction: sourceCheckpoint.functionCode || undefined,
    }, llmConfig);

    // Create new checkpoint with generated function
    const newCheckpoint: PricingAgentCheckpoint = {
      ...sourceCheckpoint,
      _id: undefined, // Will be set by MongoDB
      functionCode: functionResult.code,
      checkpointTrigger: 'function_formula_code_updated',
      createdAt: new Date(),
      checkpointDescription: feedback ? `Function regenerated with feedback: ${feedback}` : 'Function generated',
    };

    return this.createCheckpoint(newCheckpoint);
  }
}
