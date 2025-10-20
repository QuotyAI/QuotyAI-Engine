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

export interface AuthProvider {
  name: string;

  /**
   * Verify a Firebase ID token and return user information
   */
  verifyToken(token: string): Promise<AuthUser>;

  /**
   * Get user by ID
   */
  getUserById(id: string): Promise<AuthUser | null>;

  /**
   * Create a user (if supported by provider)
   */
  createUser?(email: string, password: string, options?: any): Promise<AuthUser>;

  /**
   * Delete a user (if supported by provider)
   */
  deleteUser?(id: string): Promise<void>;
}
