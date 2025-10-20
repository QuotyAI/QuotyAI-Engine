import { Injectable, Inject } from '@nestjs/common';
import { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import { Tenant, User, UserTenant, LLMConfiguration } from '../models/mongodb.model';

@Injectable()
export class TenantService {
  constructor(
    @Inject('DATABASE_CONNECTION')
    private db: Db
  ) {}

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

  async getTenantById(tenantId: string): Promise<Tenant | null> {
    const result = await this.db.collection('tenants').findOne({
      _id: new ObjectId(tenantId),
      deletedAt: null
    });
    return result as Tenant | null;
  }

  async getAllTenants(): Promise<Tenant[]> {
    const result = await this.db.collection('tenants').find({
      deletedAt: null
    }).toArray();
    return result as Tenant[];
  }

  async updateTenant(tenantId: string, updateData: Partial<Omit<Tenant, '_id' | 'createdAt' | 'deletedAt'>>): Promise<Tenant | null> {
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
    return result?.value as Tenant | null;
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

  async getUserTenants(userId: string): Promise<Tenant[]> {
    const userTenants = await this.db.collection('userTenants').find({
      userId: new ObjectId(userId),
      removedAt: null
    }).toArray();

    const tenantIds = userTenants.map(ut => ut.tenantId);
    const result = await this.db.collection('tenants').find({
      _id: { $in: tenantIds },
      deletedAt: null
    }).toArray();
    return result as Tenant[];
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
