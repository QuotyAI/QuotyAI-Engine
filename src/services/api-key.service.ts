import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import { ApiKey } from '../models/mongodb.model';

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(@Inject('DATABASE_CONNECTION') private db: Db) {
    this.logger.log('ApiKeyService initialized');
  }

  private get apiKeyCollection() {
    return this.db.collection<ApiKey>('api-keys');
  }

  async createApiKey(tenantId: string, name: string, expiresAt?: Date): Promise<{ key: string; apiKey: ApiKey }> {
    const rawKey = `ak_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const hashedKey = this.hashToken(rawKey);

    const apiKey: ApiKey = {
      name,
      key: hashedKey,
      tenantId: new ObjectId(tenantId),
      isActive: true,
      createdAt: new Date(),
      expiresAt,
    };

    const result = await this.apiKeyCollection.insertOne(apiKey);
    const createdApiKey = {
      _id: result.insertedId,
      ...apiKey,
    };

    this.logger.log(`Created API key: ${name} for tenant: ${tenantId}`);
    return { key: rawKey, apiKey: createdApiKey };
  }

  async findApiKeys(tenantId: string): Promise<ApiKey[]> {
    const filter = {
      tenantId: new ObjectId(tenantId),
      deletedAt: null
    };

    const apiKeys = await this.apiKeyCollection.find(filter).toArray();
    this.logger.log(`Found ${apiKeys.length} API keys for tenant: ${tenantId}`);
    return apiKeys;
  }

  async findOneApiKey(id: string, tenantId: string): Promise<ApiKey | null> {
    const filter = {
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
      deletedAt: null
    };

    const apiKey = await this.apiKeyCollection.findOne(filter);
    if (apiKey) {
      this.logger.log(`Found API key: ${apiKey.name} (${id})`);
    } else {
      this.logger.warn(`API key not found: ${id} for tenant: ${tenantId}`);
    }
    return apiKey;
  }

  async updateApiKey(id: string, tenantId: string, updateData: Partial<Pick<ApiKey, 'name' | 'isActive' | 'expiresAt'>>): Promise<ApiKey | null> {
    const filter = {
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
      deletedAt: null
    };

    await this.apiKeyCollection.updateOne(filter, { $set: updateData });
    const updatedApiKey = await this.findOneApiKey(id, tenantId);

    if (updatedApiKey) {
      this.logger.log(`Updated API key: ${updatedApiKey.name} (${id})`);
    } else {
      this.logger.warn(`API key not found after update: ${id} for tenant: ${tenantId}`);
    }

    return updatedApiKey;
  }

  async deleteApiKey(id: string, tenantId: string): Promise<boolean> {
    const filter = {
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
      deletedAt: null
    };

    const result = await this.apiKeyCollection.updateOne(filter, { $set: { deletedAt: new Date() } });
    const deleted = result.modifiedCount > 0;

    if (deleted) {
      this.logger.log(`Soft deleted API key: ${id}`);
    } else {
      this.logger.warn(`API key not found for deletion: ${id} for tenant: ${tenantId}`);
    }

    return deleted;
  }

  async validateApiKey(hashedToken: string): Promise<ApiKey | null> {
    //const hashedToken = this.hashToken(rawKey);
    const apiKey = await this.apiKeyCollection.findOne({
      key: hashedToken,
      isActive: true,
      deletedAt: null,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $eq: null } } as any,
        { expiresAt: { $gt: new Date() } }
      ]
    });

    if (apiKey) {
      // Update last used timestamp
      await this.apiKeyCollection.updateOne(
        { _id: apiKey._id },
        { $set: { lastUsedAt: new Date() } }
      );
    } else {
      console.debug(`validateApiKey token=${hashedToken} not found`);
    }

    return apiKey;
  }

  private hashToken(token: string): string {
    const { createHash } = require('crypto');
    return createHash('sha256').update(token).digest('hex');
  }
}
