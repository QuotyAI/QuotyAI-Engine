import { Injectable } from '@nestjs/common';
import { AuthProvider, AuthUser, ApiKeyResponse } from './auth-provider.interface';
import { ApiKeyService } from '../services/api-key.service';

@Injectable()
export class ApiTokenAuthProvider implements AuthProvider {
  name = 'api-token';

  constructor(private readonly apiKeyService: ApiKeyService) {}

  async verifyToken(token: string): Promise<AuthUser> {
    console.debug(`verifyToken start`)
    const apiKey = await this.apiKeyService.validateApiKey(token);

    if (!apiKey) {
      console.debug(`verifyToken Invalid API token`)
      throw new Error('Invalid API token');
    } else {
      console.debug(`verifyToken apiKey=${apiKey}`)
    }

    return {
      id: apiKey._id!.toString(),
      email: `api-key-${apiKey.name}@tenant-${apiKey.tenantId}`,
      emailVerified: true, // API keys are pre-verified
      tenantId: apiKey.tenantId.toString(),
      provider: 'api-token',
      providerId: apiKey._id!.toString(),
      role: 'api-user', // API tokens have limited permissions
    };
  }

  async getUserById(id: string): Promise<AuthUser | null> {
    // For API tokens, we need to find the API key by ID and then get the tenant
    // This is a bit tricky since we don't have tenant context here
    // We'll need to search across all tenants (not ideal but necessary for this auth pattern)
    // In a real implementation, you might want to cache this or store tenant info differently

    // For now, we'll return null since this method is not typically used for API tokens
    // The verifyToken method is the primary one used
    return null;
  }

  // Method to create a new API key (for admin use)
  async createApiKey(tenantId: string, name: string, expiresAt?: Date): Promise<ApiKeyResponse> {
    return this.apiKeyService.createApiKey(tenantId, name, expiresAt);
  }
}
