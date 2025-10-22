import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { AuthProvider, AuthUser, CustomClaims, CreateUserOptions } from './auth-provider.interface';

@Injectable()
export class FirebaseAuthProvider implements AuthProvider {
  name = 'firebase';

  async verifyToken(token: string): Promise<AuthUser> {
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);

      return {
        id: decodedToken.uid,
        email: decodedToken.email || '',
        emailVerified: decodedToken.email_verified || false,
        role: decodedToken.role || 'user',
        tenantId: decodedToken.tenantId,
        provider: 'firebase',
        providerId: decodedToken.uid,
        metadata: {
          creationTime: decodedToken.auth_time ? new Date(decodedToken.auth_time * 1000).toISOString() : undefined,
          lastSignInTime: decodedToken.auth_time ? new Date(decodedToken.auth_time * 1000).toISOString() : undefined,
        },
      };
    } catch (error) {
      throw new Error(`Firebase token verification failed: ${error.message}`);
    }
  }

  async getUserById(id: string): Promise<AuthUser | null> {
    try {
      const userRecord = await admin.auth().getUser(id);

      return {
        id: userRecord.uid,
        email: userRecord.email || '',
        emailVerified: userRecord.emailVerified,
        role: (userRecord.customClaims as CustomClaims)?.role || 'user',
        tenantId: (userRecord.customClaims as CustomClaims)?.tenantId,
        provider: 'firebase',
        providerId: userRecord.uid,
        metadata: {
          creationTime: userRecord.metadata.creationTime,
          lastSignInTime: userRecord.metadata.lastSignInTime,
        },
      };
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        return null;
      }
      throw new Error(`Failed to get Firebase user: ${error.message}`);
    }
  }

  async createUser(email: string, password: string, options?: CreateUserOptions): Promise<AuthUser> {
    try {
      const userRecord = await admin.auth().createUser({
        email,
        password,
        ...options,
      });

      // Set custom claims if provided
      if (options?.role || options?.tenantId) {
        await admin.auth().setCustomUserClaims(userRecord.uid, {
          role: options.role || 'user',
          tenantId: options.tenantId,
        });
      }

      return {
        id: userRecord.uid,
        email: userRecord.email || '',
        emailVerified: userRecord.emailVerified,
        role: options?.role || 'user',
        tenantId: options?.tenantId,
        provider: 'firebase',
        providerId: userRecord.uid,
        metadata: {
          creationTime: userRecord.metadata.creationTime,
          lastSignInTime: userRecord.metadata.lastSignInTime,
        },
      };
    } catch (error) {
      throw new Error(`Failed to create Firebase user: ${error.message}`);
    }
  }

  async deleteUser(id: string): Promise<void> {
    try {
      await admin.auth().deleteUser(id);
    } catch (error) {
      throw new Error(`Failed to delete Firebase user: ${error.message}`);
    }
  }
}
