import { applicationDefault, cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

export interface FirebaseAdminServices {
  app: App;
  auth: Auth;
  db: Firestore;
  projectId: string;
}

let cached: FirebaseAdminServices | null = null;

function projectIdFromEnv(): string {
  return String(
    process.env.FIREBASE_PROJECT_ID
    || process.env.GOOGLE_CLOUD_PROJECT
    || process.env.GCLOUD_PROJECT
    || ''
  ).trim();
}

export function firebaseAdminConfigured(): boolean {
  return Boolean(projectIdFromEnv() && process.env.FIREBASE_WEB_API_KEY?.trim() && process.env.FIREBASE_APP_ID?.trim());
}

function serviceAccountCredential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return applicationDefault();
  const parsed = JSON.parse(raw);
  return cert(parsed);
}

export function firebaseAdminServices(): FirebaseAdminServices {
  if (cached) return cached;
  const projectId = projectIdFromEnv();
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID_NOT_CONFIGURED');
  const app = getApps()[0] ?? initializeApp({ credential: serviceAccountCredential(), projectId });
  cached = { app, auth: getAuth(app), db: getFirestore(app), projectId };
  return cached;
}

export function firebasePublicConfig() {
  const projectId = projectIdFromEnv();
  const configured = firebaseAdminConfigured();
  return {
    configured,
    authRequired: process.env.NODE_ENV === 'production' || process.env.FIREBASE_AUTH_REQUIRED === 'true',
    selfRegistrationEnabled: process.env.FIREBASE_SELF_REGISTRATION_ENABLED !== 'false',
    firebase: configured ? {
      apiKey: String(process.env.FIREBASE_WEB_API_KEY),
      authDomain: String(process.env.FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`),
      projectId,
      appId: String(process.env.FIREBASE_APP_ID)
    } : null
  };
}
