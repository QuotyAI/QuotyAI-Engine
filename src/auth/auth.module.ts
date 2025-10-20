import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from '../controllers/auth.controller';
import { FirebaseAuthProvider } from './firebase-auth.provider';
import { AuthGuard } from './auth.guard';
import { TenantService } from '../services/tenant.service';
import { databaseConfig } from '../config/database.config';
import { initializeFirebase } from '../config/firebase.config';

@Module({
  controllers: [],
  providers: [
    AuthService,
    FirebaseAuthProvider,
    AuthGuard,
    TenantService,
    databaseConfig,
    {
      provide: 'AUTH_PROVIDERS',
      useFactory: (firebaseProvider: FirebaseAuthProvider) => {
        const providers = new Map<string, any>();
        providers.set('firebase', firebaseProvider);
        // Add other providers here in the future
        // providers.set('supabase', supabaseProvider);
        // providers.set('auth0', auth0Provider);
        return providers;
      },
      inject: [FirebaseAuthProvider],
    },
  ],
  exports: [AuthService, AuthGuard],
})
export class AuthModule implements OnModuleInit {
  constructor(private configService: ConfigService) {}

  onModuleInit() {
    // Initialize Firebase Admin SDK
    initializeFirebase(this.configService);
  }
}
