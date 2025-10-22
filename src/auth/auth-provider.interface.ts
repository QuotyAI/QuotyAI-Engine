export interface AuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
  role?: string;
  tenantId?: string;
  provider: string;
  providerId: string;
  metadata?: {
    creationTime?: string;
    lastSignInTime?: string;
  };
}

export interface CreateUserOptions {
  role?: string;
  tenantId?: string;
  displayName?: string;
  emailVerified?: boolean;
}

export interface CustomClaims {
  role?: string;
  tenantId?: string;
}

import { ObjectId } from 'mongodb';

export interface ApiKeyResponse {
  key: string;
  apiKey: {
    _id?: ObjectId;
    name: string;
    tenantId: ObjectId;
    expiresAt?: Date;
    createdAt: Date;
  };
}

export interface AuthProvider {
  name: string;

  /**
   * Verify a token and return user information
   */
  verifyToken(token: string): Promise<AuthUser>;

  /**
   * Get user by ID
   */
  getUserById(id: string): Promise<AuthUser | null>;

  /**
   * Create a user (if supported by provider)
   */
  createUser?(email: string, password: string, options?: CreateUserOptions): Promise<AuthUser>;

  /**
   * Delete a user (if supported by provider)
   */
  deleteUser?(id: string): Promise<void>;
}
