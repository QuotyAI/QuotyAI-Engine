import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export const initializeFirebase = (configService: ConfigService) => {
  // Check if Firebase is already initialized
  if (admin.apps.length > 0) {
    return admin;
  }

  const serviceAccountPath = configService.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');

  if (!serviceAccountPath) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH environment variable is required');
  }

  // Resolve the path relative to the project root if it's not absolute
  const resolvedPath = path.isAbsolute(serviceAccountPath)
    ? serviceAccountPath
    : path.join(process.cwd(), serviceAccountPath);

  // Check if the file exists
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Firebase service account file not found at: ${resolvedPath}`);
  }

  // Read and parse the service account JSON file
  let serviceAccount: admin.ServiceAccount;
  try {
    const serviceAccountJson = fs.readFileSync(resolvedPath, 'utf8');
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch (error) {
    throw new Error(`Failed to read or parse Firebase service account file: ${error.message}`);
  }

  // Initialize Firebase Admin SDK
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  return admin;
};
