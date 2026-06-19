/// <reference types="vite/client" />
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

import appletConfig from '../../firebase-applet-config.json';

const configSafe = (appletConfig || {}) as any;

const cleanEnvVar = (value: any): string => {
  if (typeof value !== 'string') return '';
  let trimmed = value.trim();
  // Strip outer quotes if both matching starting/ending quotes exist
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    trimmed = trimmed.substring(1, trimmed.length - 1);
  }
  // Strip any remaining leading double or single quotes
  if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
    trimmed = trimmed.substring(1);
  }
  // Strip any remaining trailing double or single quotes
  if (trimmed.endsWith('"') || trimmed.endsWith("'")) {
    trimmed = trimmed.substring(0, trimmed.length - 1);
  }
  return trimmed.trim();
};

const getResolvedProjectId = (): string => {
  const configId = configSafe.projectId;
  const envId = cleanEnvVar(import.meta.env.VITE_FIREBASE_PROJECT_ID);
  
  if (configId && configId !== 'bangonlocal' && configId !== 'prismlocal') {
    return configId;
  }
  if (envId && envId !== 'bangonlocal' && envId !== 'prismlocal') {
    return envId;
  }
  return configId || envId || 'prismlocal';
};

const resolvedProjectId = getResolvedProjectId();
const isConfigReal = configSafe.projectId && configSafe.projectId !== 'bangonlocal' && configSafe.projectId !== 'prismlocal';

const defaultAuthDomain = (isConfigReal ? configSafe.authDomain : null) || cleanEnvVar(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN) || configSafe.authDomain || `${resolvedProjectId}.firebaseapp.com`;

const firebaseConfig = {
  apiKey: (isConfigReal ? configSafe.apiKey : null) || cleanEnvVar(import.meta.env.VITE_FIREBASE_API_KEY) || configSafe.apiKey,
  authDomain: defaultAuthDomain,
  projectId: resolvedProjectId,
  storageBucket: (isConfigReal ? configSafe.storageBucket : null) || cleanEnvVar(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET) || configSafe.storageBucket,
  messagingSenderId: (isConfigReal ? configSafe.messagingSenderId : null) || cleanEnvVar(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID) || configSafe.messagingSenderId,
  appId: (isConfigReal ? configSafe.appId : null) || cleanEnvVar(import.meta.env.VITE_FIREBASE_APP_ID) || configSafe.appId,
};

console.log('[Firebase Init] config keys loaded:', Object.keys(firebaseConfig).reduce((acc, key) => {
  acc[key] = firebaseConfig[key as keyof typeof firebaseConfig] ? `Present (length ${firebaseConfig[key as keyof typeof firebaseConfig]?.length})` : 'Missing/Undefined';
  return acc;
}, {} as Record<string, string>));

const databaseId = cleanEnvVar(import.meta.env.VITE_FIREBASE_DATABASE_ID) || configSafe.firestoreDatabaseId;

const app = initializeApp(firebaseConfig);

// Safe initialization for the default database vs custom multi-database IDs with long-polling to prevent WebSocket failures in sandbox environment
export const db = (databaseId && databaseId !== 'default' && databaseId !== '(default)') 
  ? initializeFirestore(app, { experimentalForceLongPolling: true }, databaseId) 
  : initializeFirestore(app, { experimentalForceLongPolling: true });
export const auth = getAuth();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  const isOffline = errorMsg.toLowerCase().includes('offline') || errorMsg.toLowerCase().includes('failed to get document');
  
  const errInfo: FirestoreErrorInfo = {
    error: errorMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };

  if (isOffline) {
    console.warn('[Firestore Offline Support] Handled connection offline state: ', JSON.stringify(errInfo));
  } else {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }
  throw new Error(JSON.stringify(errInfo));
}
