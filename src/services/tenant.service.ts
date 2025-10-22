import { Injectable, Inject } from '@nestjs/common';
import { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import { Tenant, User, UserTenant, LLMConfiguration } from '../models/mongodb.model';
import { UpdateTenantDto } from '../dtos/update-tenant.dto';
import { TenantDto } from '../dtos/tenant.dto';
import { LLMConfigurationResponseDto } from '../dtos/llm-configuration-response.dto';

@Injectable()
export class TenantService {
  constructor(
    @Inject('DATABASE_CONNECTION')
    private db: Db
  ) { }

  private transformLLMConfiguration(config: LLMConfiguration | undefined): LLMConfigurationResponseDto | undefined {
    if (!config) return undefined;
    const { apiKey, ...responseConfig } = config;
    return responseConfig;
  }

  private transformTenantToDto(tenant: Tenant): TenantDto {
    return {
      ...tenant,
      builderLlmConfiguration: this.transformLLMConfiguration(tenant.builderLlmConfiguration),
      chatbotLlmConfiguration: this.transformLLMConfiguration(tenant.chatbotLlmConfiguration),
    };
  }

  // Tenant operations
  async createTenant(tenantData: Omit<Tenant, '_id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<Tenant> {
    const tenant: Tenant = {
      ...tenantData,
      _id: new ObjectId(),
      createdAt: new Date(),
      isActive: tenantData.isActive ?? true,
    };

    await this.db.collection('tenants').insertOne(tenant);
    return tenant;
  }

  async getTenantById(tenantId: string): Promise<TenantDto | null> {
    const result = await this.db.collection('tenants').findOne({
      _id: new ObjectId(tenantId),
      deletedAt: null
    });
    if (!result) return null;
    return this.transformTenantToDto(result as Tenant);
  }

  async getTenantByIdInternal(tenantId: string): Promise<Tenant | null> {
    const result = await this.db.collection('tenants').findOne({
      _id: new ObjectId(tenantId),
      deletedAt: null
    });
    return result as Tenant | null;
  }

  async getAllTenants(): Promise<TenantDto[]> {
    const result = await this.db.collection('tenants').find({
      deletedAt: null
    }).toArray();
    return (result as Tenant[]).map(tenant => this.transformTenantToDto(tenant));
  }

  async updateTenant(tenantId: string, updateData: UpdateTenantDto): Promise<TenantDto | null> {
    // Handle subscription update separately if present
    const result = await this.db.collection('tenants').findOneAndUpdate(
      { _id: new ObjectId(tenantId), deletedAt: null },
      {
        $set: {
          ...updateData,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );
    if (!result?.value) return null;
    return this.transformTenantToDto(result.value as Tenant);
  }

  async updateTenantBasicInfo(tenantId: string, basicInfo: { name?: string; description?: string }): Promise<TenantDto | null> {
    const updateData: any = { updatedAt: new Date() };

    if (basicInfo.name !== undefined) {
      updateData.name = basicInfo.name;
    }
    if (basicInfo.description !== undefined) {
      updateData.description = basicInfo.description;
    }

    const result = await this.db.collection('tenants').findOneAndUpdate(
      { _id: new ObjectId(tenantId), deletedAt: null },
      { $set: updateData },
      { returnDocument: 'after' }
    );
    if (!result?.value) return null;
    return this.transformTenantToDto(result.value as Tenant);
  }



  async updateTenantBuilderLlmConfig(tenantId: string, builderLlmConfiguration: LLMConfiguration): Promise<TenantDto | null> {
    // Get existing tenant to preserve API key if new one is null/empty
    const existingTenant = await this.getTenantByIdInternal(tenantId);
    if (!existingTenant) return null;

    // If new API key is null or empty, keep the existing one
    const finalConfig = { ...builderLlmConfiguration };
    if (!finalConfig.apiKey || finalConfig.apiKey.trim() === '') {
      finalConfig.apiKey = existingTenant.builderLlmConfiguration?.apiKey || '';
    }

    const result = await this.db.collection('tenants').findOneAndUpdate(
      { _id: new ObjectId(tenantId), deletedAt: null },
      {
        $set: {
          builderLlmConfiguration: finalConfig,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );
    if (!result?.value) return null;
    return this.transformTenantToDto(result.value as Tenant);
  }

  async updateTenantChatbotLlmConfig(tenantId: string, chatbotLlmConfiguration: LLMConfiguration): Promise<TenantDto | null> {
    // Get existing tenant to preserve API key if new one is null/empty
    const existingTenant = await this.getTenantByIdInternal(tenantId);
    if (!existingTenant) return null;

    // If new API key is null or empty, keep the existing one
    const finalConfig = { ...chatbotLlmConfiguration };
    if (!finalConfig.apiKey || finalConfig.apiKey.trim() === '') {
      finalConfig.apiKey = existingTenant.chatbotLlmConfiguration?.apiKey || '';
    }

    const result = await this.db.collection('tenants').findOneAndUpdate(
      { _id: new ObjectId(tenantId), deletedAt: null },
      {
        $set: {
          chatbotLlmConfiguration: finalConfig,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );
    if (!result?.value) return null;
    return this.transformTenantToDto(result.value as Tenant);
  }

  async updateTenantSubscription(tenantId: string, subscriptionData: any): Promise<TenantDto | null> {
    // Convert date strings to Date objects
    const subscriptionUpdate: any = { ...subscriptionData.subscription };
    if (subscriptionData.subscription.startDate) {
      subscriptionUpdate.startDate = new Date(subscriptionData.subscription.startDate);
    }
    if (subscriptionData.subscription.endDate) {
      subscriptionUpdate.endDate = new Date(subscriptionData.subscription.endDate);
    }

    const result = await this.db.collection('tenants').findOneAndUpdate(
      { _id: new ObjectId(tenantId), deletedAt: null },
      {
        $set: {
          subscription: subscriptionUpdate,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );
    if (!result?.value) return null;
    return this.transformTenantToDto(result.value as Tenant);
  }

  async deleteTenant(tenantId: string): Promise<boolean> {
    const result = await this.db.collection('tenants').updateOne(
      { _id: new ObjectId(tenantId), deletedAt: null },
      { $set: { deletedAt: new Date() } }
    );
    return result.modifiedCount > 0;
  }

  // User operations
  async createUser(userData: Omit<User, '_id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<User> {
    const user: User = {
      ...userData,
      _id: new ObjectId(),
      createdAt: new Date(),
      isActive: userData.isActive ?? true,
    };

    await this.db.collection('users').insertOne(user);
    return user;
  }

  async getUserByFirebaseId(firebaseId: string): Promise<User | null> {
    const result = await this.db.collection('users').findOne({
      firebaseId,
      deletedAt: null
    });
    return result as User | null;
  }

  async getUserById(userId: string): Promise<User | null> {
    const result = await this.db.collection('users').findOne({
      _id: new ObjectId(userId),
      deletedAt: null
    });
    return result as User | null;
  }

  async updateUser(userId: string, updateData: Partial<Omit<User, '_id' | 'createdAt' | 'deletedAt'>>): Promise<User | null> {
    const result = await this.db.collection('users').findOneAndUpdate(
      { _id: new ObjectId(userId), deletedAt: null },
      {
        $set: {
          ...updateData,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );
    return result?.value as User | null;
  }

  async ensureUserExists(userData: Omit<User, '_id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<User> {
    let user = await this.getUserByFirebaseId(userData.firebaseId);
    if (!user) {
      user = await this.createUser(userData);
    }
    return user;
  }

  async updateUserSelectedTenant(firebaseId: string, selectedTenantId: string): Promise<User | null> {
    const result = await this.db.collection('users').findOneAndUpdate(
      { firebaseId, deletedAt: null },
      {
        $set: {
          selectedTenantId,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );
    return result?.value as User | null;
  }

  // User-Tenant relationship operations
  async assignUserToTenant(userId: string, tenantId: string, role: 'admin' | 'member' = 'member'): Promise<UserTenant> {
    // Check if relationship already exists
    const existing = await this.db.collection('userTenants').findOne({
      userId: new ObjectId(userId),
      tenantId: new ObjectId(tenantId),
      removedAt: null
    });

    if (existing) {
      throw new Error('User is already assigned to this tenant');
    }

    const userTenant: UserTenant = {
      _id: new ObjectId(),
      userId: new ObjectId(userId),
      tenantId: new ObjectId(tenantId),
      role,
      assignedAt: new Date(),
    };

    await this.db.collection('userTenants').insertOne(userTenant);
    return userTenant;
  }

  async removeUserFromTenant(userId: string, tenantId: string): Promise<boolean> {
    const result = await this.db.collection('userTenants').updateOne(
      {
        userId: new ObjectId(userId),
        tenantId: new ObjectId(tenantId),
        removedAt: null
      },
      { $set: { removedAt: new Date() } }
    );
    return result.modifiedCount > 0;
  }

  async getTenantUsers(tenantId: string): Promise<User[]> {
    const userTenants = await this.db.collection('userTenants').find({
      tenantId: new ObjectId(tenantId),
      removedAt: null
    }).toArray();

    const userIds = userTenants.map(ut => ut.userId);
    const result = await this.db.collection('users').find({
      _id: { $in: userIds },
      deletedAt: null
    }).toArray();
    return result as User[];
  }

  async getUserTenants(userId: string): Promise<TenantDto[]> {
    const userTenants = await this.db.collection('userTenants').find({
      userId: new ObjectId(userId),
      removedAt: null
    }).toArray();

    const tenantIds = userTenants.map(ut => ut.tenantId);
    const result = await this.db.collection('tenants').find({
      _id: { $in: tenantIds },
      deletedAt: null
    }).toArray();
    return (result as Tenant[]).map(tenant => this.transformTenantToDto(tenant));
  }

  async getUserTenantRole(userId: string, tenantId: string): Promise<UserTenant | null> {
    const result = await this.db.collection('userTenants').findOne({
      userId: new ObjectId(userId),
      tenantId: new ObjectId(tenantId),
      removedAt: null
    });
    return result as UserTenant | null;
  }

  async updateUserTenantRole(userId: string, tenantId: string, role: 'admin' | 'member'): Promise<boolean> {
    const result = await this.db.collection('userTenants').updateOne(
      {
        userId: new ObjectId(userId),
        tenantId: new ObjectId(tenantId),
        removedAt: null
      },
      { $set: { role } }
    );
    return result.modifiedCount > 0;
  }
}
