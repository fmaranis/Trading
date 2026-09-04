import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

export interface FirebasePublicRuntimeConfig {
  configured: boolean;
  authRequired: boolean;
  selfRegistrationEnabled: boolean;
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    appId: string;
  } | null;
}

export interface FirebaseClientRuntime {
  config: FirebasePublicRuntimeConfig;
  app: FirebaseApp | null;
  auth: Auth | null;
}

let runtimePromise: Promise<FirebaseClientRuntime> | null = null;

export function loadFirebaseClientRuntime(): Promise<FirebaseClientRuntime> {
  if (runtimePromise) return runtimePromise;
  runtimePromise = (async () => {
    const response = await fetch('/api/account/public-config');
    if (!response.ok) throw new Error(`FIREBASE_PUBLIC_CONFIG_HTTP_${response.status}`);
    const config = await response.json() as FirebasePublicRuntimeConfig;
    if (!config.configured || !config.firebase) return { config, app: null, auth: null };
    const app = getApps()[0] ?? initializeApp(config.firebase);
    return { config, app, auth: getAuth(app) };
  })();
  return runtimePromise;
}
