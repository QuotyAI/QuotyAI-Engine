import { Injectable, Inject, Logger } from '@nestjs/common';
import { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
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
import { AiHappyPathDatasetGenerationAgentService } from '../ai-agents/ai-happy-path-dataset-generation.agent';
import { isMultiTenancyEnabled, DEFAULT_TENANT_ID } from '../config/multi-tenancy.config';

@Injectable()
export class PricingAgentService {
  private readonly logger = new Logger(PricingAgentService.name);

  constructor(
    @Inject('DATABASE_CONNECTION') private db: Db,
    private readonly aiSchemaGenerationAgent: AiSchemaGenerationAgentService,
    private readonly aiFormulaGenerationAgent: AiFormulaGenerationAgentService,
    private readonly aiHappyPathDatasetGenerationAgent: AiHappyPathDatasetGenerationAgentService
  ) {
    this.logger.log('PricingAgentService initialized');
  }

  private get collection() {
    return this.db.collection<PricingAgent>('pricing-agents');
  }

  private get checkpointCollection() {
    return this.db.collection<PricingAgentCheckpoint>('pricing-agent-checkpoints');
  }



  async create(pricingAgent: Omit<PricingAgent, '_id' | 'createdAt'>): Promise<PricingAgent> {
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

  async findAll(tenantId?: string): Promise<PricingAgent[]> {
    this.logger.log(`Finding all pricing agents for tenant: ${tenantId}`);

    try {
      const effectiveTenantId = isMultiTenancyEnabled ? tenantId : DEFAULT_TENANT_ID;
      const filter = isMultiTenancyEnabled
        ? (effectiveTenantId ? { tenantId: effectiveTenantId, deletedAt: null } : { deletedAt: null })
        : { deletedAt: null }; // No tenant filter in single-tenant mode
      const agents = await this.collection.find(filter).toArray();

      this.logger.log(`Successfully retrieved ${agents.length} pricing agents for tenant: ${tenantId}`);
      return agents;
    } catch (error) {
      this.logger.error(`Failed to find all pricing agents: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findAllWithLatestCheckpoint(tenantId?: string): Promise<PricingAgentWithLatestCheckpoint[]> {
    this.logger.log(`Finding all pricing agents with latest checkpoints for tenant: ${tenantId}`);

    try {
      const effectiveTenantId = isMultiTenancyEnabled ? tenantId : DEFAULT_TENANT_ID;
      const filter = isMultiTenancyEnabled
        ? (effectiveTenantId ? { tenantId: effectiveTenantId, deletedAt: null } : { deletedAt: null })
        : { deletedAt: null }; // No tenant filter in single-tenant mode
      const agents = await this.collection.find(filter).toArray();

      if (agents.length === 0) {
        this.logger.log(`No pricing agents found for tenant: ${tenantId}`);
        return [];
      }

      // Collect all agent IDs
      const agentIds = agents.map(agent => agent._id!);

      // Fetch latest checkpoints for all agents in a single query
      const matchCondition: any = {
        pricingAgentId: { $in: agentIds },
        deletedAt: null
      };
      if (isMultiTenancyEnabled && effectiveTenantId) {
        matchCondition.tenantId = effectiveTenantId;
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
      const checkpointMap = new Map<string, any>();
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

  async findOne(id: string, tenantId?: string): Promise<PricingAgent | null> {
    this.logger.log(`Finding pricing agent: ${id} for tenant: ${tenantId}`);

    try {
      const filter = { _id: new ObjectId(id), deletedAt: null };
      if (tenantId) {
        filter['tenantId'] = tenantId;
      }
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

  async update(id: string, updateData: Partial<Omit<PricingAgent, '_id' | 'createdAt'>>, tenantId?: string): Promise<PricingAgent | null> {
    this.logger.log(`Updating pricing agent: ${id} for tenant: ${tenantId}`);

    try {
      const filter = { _id: new ObjectId(id) };
      if (tenantId) {
        filter['tenantId'] = tenantId;
      }
      await this.collection.updateOne(filter, { $set: updateData });
      const updatedAgent = await this.findOne(id, tenantId);

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

  async delete(id: string, tenantId?: string): Promise<boolean> {
    this.logger.log(`Soft deleting pricing agent: ${id} for tenant: ${tenantId}`);

    try {
      const filter = { _id: new ObjectId(id) };
      if (tenantId) {
        filter['tenantId'] = tenantId;
      }
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
    const filter: any = { deletedAt: null };
    if (pricingAgentId) {
      filter.pricingAgentId = new ObjectId(pricingAgentId);
    }
    if (tenantId) {
      filter.tenantId = tenantId;
    }
    return this.checkpointCollection.find(filter).sort({ version: 1 }).toArray();
  }

  async findLatestCheckpoints(pricingAgentId: string, tenantId?: string, limit: number = 50): Promise<PricingAgentCheckpoint[]> {
    this.logger.log(`Finding latest ${limit} checkpoints for agent: ${pricingAgentId} for tenant: ${tenantId}`);

    try {
      const filter: any = { pricingAgentId: new ObjectId(pricingAgentId), deletedAt: null };
      if (tenantId) {
        filter.tenantId = tenantId;
      }
      const checkpoints = await this.checkpointCollection.find(filter).sort({ version: -1 }).limit(limit).toArray();

      this.logger.log(`Successfully retrieved ${checkpoints.length} latest checkpoints for agent: ${pricingAgentId}`);
      return checkpoints;
    } catch (error) {
      this.logger.error(`Failed to find latest checkpoints for agent ${pricingAgentId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findOneCheckpoint(id: string, tenantId?: string): Promise<PricingAgentCheckpoint | null> {
    const filter = { _id: new ObjectId(id), deletedAt: null };
    if (tenantId) {
      filter['tenantId'] = tenantId;
    }
    return this.checkpointCollection.findOne(filter);
  }

  async findLatestCheckpoint(pricingAgentId: string, tenantId?: string): Promise<PricingAgentCheckpoint | null> {
    const filter: any = { pricingAgentId: new ObjectId(pricingAgentId), deletedAt: null };
    if (tenantId) {
      filter.tenantId = tenantId;
    }
    return this.checkpointCollection.find(filter).sort({ version: -1 }).limit(1).toArray().then(checkpoints => checkpoints[0] || null);
  }

  async updateCheckpoint(id: string, updateData: Partial<Omit<PricingAgentCheckpoint, '_id' | 'createdAt'>>, tenantId?: string): Promise<PricingAgentCheckpoint | null> {
    const filter = { _id: new ObjectId(id) };
    if (tenantId) {
      filter['tenantId'] = tenantId;
    }
    await this.checkpointCollection.updateOne(filter, { $set: updateData });
    return this.findOneCheckpoint(id, tenantId);
  }

  async deleteCheckpoint(id: string, tenantId?: string): Promise<boolean> {
    const filter = { _id: new ObjectId(id) };
    if (tenantId) {
      filter['tenantId'] = tenantId;
    }
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
      version: sourceCheckpoint.version + 1,
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
      version: sourceCheckpoint.version + 1,
      humanInputMessages: [...sourceCheckpoint.humanInputMessages] as HumanInputMessage[], // Clone the array
      checkpointTrigger: 'input_message_deleted',
      createdAt: new Date(),
      checkpointDescription: `Deleted input message: ${messageToDelete.message}`,
    };

    // Remove the message from inputMessages
    newCheckpoint.humanInputMessages.splice(messageIndex, 1);

    return this.createCheckpoint(newCheckpoint);
  }

  async buildAgent(pricingAgentId: string, checkpointId: string, tenantId?: string): Promise<PricingAgentCheckpoint | null> {
    const sourceCheckpoint = await this.findOneCheckpoint(checkpointId, tenantId);
    if (!sourceCheckpoint) {
      return null; // Checkpoint not found
    }

    // Combine all input messages into a pricing description
    const pricingDescription = sourceCheckpoint.humanInputMessages
      .map(msg => {
        const parts: string[] = [];
        if (msg.message) parts.push(msg.message);
        return parts.join(' ');
      })
      .join('\n');

    if (!pricingDescription.trim()) {
      throw new Error('No input messages found to generate schema and function');
    }

    // Generate schema
    const schemaResult = await this.aiSchemaGenerationAgent.generateInputTypes({
      inputMessage: pricingDescription,
    });

    // Generate function
    const functionResult = await this.aiFormulaGenerationAgent.generatePricingFunction({
      pricingDescription: pricingDescription,
      schema: schemaResult.code,
    });

    // Generate test scenarios
    const happyPathScenarios = await this.aiHappyPathDatasetGenerationAgent.generateHappyPathScenarios(
      pricingDescription,
      schemaResult.code,
      functionResult.code,
    );

    // TODO: Unhappy

    throw new Error('Not implemented yet'); 
  }

  async buildSchemaOnly(pricingAgentId: string, checkpointId: string, tenantId?: string): Promise<PricingAgentCheckpoint | null> {
    const sourceCheckpoint = await this.findOneCheckpoint(checkpointId, tenantId);
    if (!sourceCheckpoint) {
      return null; // Checkpoint not found
    }

    // Combine all input messages into a pricing description
    const pricingDescription = sourceCheckpoint.humanInputMessages
      .map(msg => {
        const parts: string[] = [];
        if (msg.message) parts.push(msg.message);
        return parts.join(' ');
      })
      .join('\n');

    if (!pricingDescription.trim()) {
      throw new Error('No input messages found to generate schema');
    }

    // Generate only schema
    const schemaResult = await this.aiSchemaGenerationAgent.generateInputTypes({
      inputMessage: pricingDescription,
    });

    // Update existing checkpoint with generated schema only
    const updateData = {
      functionSchema: schemaResult.code
    };

    return this.updateCheckpoint(checkpointId, updateData, tenantId);
  }

  async buildFormulaOnly(pricingAgentId: string, checkpointId: string, tenantId?: string): Promise<PricingAgentCheckpoint | null> {
    const sourceCheckpoint = await this.findOneCheckpoint(checkpointId, tenantId);
    if (!sourceCheckpoint) {
      return null; // Checkpoint not found
    }

    // Combine all input messages into a pricing description
    const pricingDescription = sourceCheckpoint.humanInputMessages
      .map(msg => {
        const parts: string[] = [];
        if (msg.message) parts.push(msg.message);
        return parts.join(' ');
      })
      .join('\n');

    if (!pricingDescription.trim()) {
      throw new Error('No input messages found to generate function');
    }

    // Generate only function
    const functionResult = await this.aiFormulaGenerationAgent.generatePricingFunction({
      pricingDescription: pricingDescription,
      schema: sourceCheckpoint.functionSchema || '',
    });

    // Update existing checkpoint with generated function only
    const updateData = {
      functionCode: functionResult.code
    };

    return this.updateCheckpoint(checkpointId, updateData, tenantId);
  }


}
