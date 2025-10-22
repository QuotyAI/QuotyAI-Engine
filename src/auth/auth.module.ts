import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from '../controllers/auth.controller';
import { FirebaseAuthProvider } from './firebase-auth.provider';
import { ApiTokenAuthProvider } from './api-token-auth.provider';
import { AuthGuard } from './auth.guard';
import { ApiTokenGuard } from './api-token.guard';
import { TenantService } from '../services/tenant.service';
import { ApiKeyService } from '../services/api-key.service';
import { AuthProvider } from './auth-provider.interface';
import { databaseConfig } from '../config/database.config';
import { initializeFirebase } from '../config/firebase.config';

@Module({
  controllers: [],
  providers: [
    AuthService,
    FirebaseAuthProvider,
    ApiTokenAuthProvider,
    AuthGuard,
    ApiTokenGuard,
    TenantService,
    ApiKeyService,
    databaseConfig,
    {
      provide: 'AUTH_PROVIDERS',
      useFactory: (firebaseProvider: FirebaseAuthProvider, apiTokenProvider: ApiTokenAuthProvider) => {
        const providers = new Map<string, AuthProvider>();
        providers.set('firebase', firebaseProvider);
        providers.set('api-token', apiTokenProvider);
        // Add other providers here in the future
        // providers.set('supabase', supabaseProvider);
        // providers.set('auth0', auth0Provider);
        return providers;
      },
      inject: [FirebaseAuthProvider, ApiTokenAuthProvider],
    },
  ],
  exports: [AuthService, AuthGuard, ApiTokenGuard],
})
export class AuthModule implements OnModuleInit {
  constructor(private configService: ConfigService) {}

  onModuleInit() {
    // Initialize Firebase Admin SDK
    initializeFirebase(this.configService);
  }
}
