import { Injectable, Inject } from '@nestjs/common';
import { AuthProvider, AuthUser, CreateUserOptions } from './auth-provider.interface';

@Injectable()
export class AuthService {
  constructor(
    @Inject('AUTH_PROVIDERS')
    private readonly providers: Map<string, AuthProvider>,
  ) {}

  /**
   * Get auth provider by name
   */
  getProvider(name: string): AuthProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Get all available providers
   */
  getProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Verify token using specified provider
   */
  async verifyToken(token: string, providerName = 'firebase'): Promise<AuthUser> {
    const provider = this.getProvider(providerName);
    if (!provider) {
      throw new Error(`Auth provider '${providerName}' not found`);
    }

    return provider.verifyToken(token);
  }

  /**
   * Get user by ID using specified provider
   */
  async getUserById(id: string, providerName = 'firebase'): Promise<AuthUser | null> {
    const provider = this.getProvider(providerName);
    if (!provider) {
      throw new Error(`Auth provider '${providerName}' not found`);
    }

    return provider.getUserById(id);
  }

  /**
   * Create user using specified provider
   */
  async createUser(
    email: string,
    password: string,
    providerName = 'firebase',
    options?: CreateUserOptions,
  ): Promise<AuthUser> {
    const provider = this.getProvider(providerName);
    if (!provider) {
      throw new Error(`Auth provider '${providerName}' not found`);
    }

    if (!provider.createUser) {
      throw new Error(`Provider '${providerName}' does not support user creation`);
    }

    return provider.createUser(email, password, options);
  }

  /**
   * Delete user using specified provider
   */
  async deleteUser(id: string, providerName = 'firebase'): Promise<void> {
    const provider = this.getProvider(providerName);
    if (!provider) {
      throw new Error(`Auth provider '${providerName}' not found`);
    }

    if (!provider.deleteUser) {
      throw new Error(`Provider '${providerName}' does not support user deletion`);
    }

    return provider.deleteUser(id);
  }
}
