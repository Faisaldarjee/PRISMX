/// <reference types="vite/client" />
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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

const rawProjectId = cleanEnvVar(import.meta.env.VITE_FIREBASE_PROJECT_ID);
const resolvedProjectId = rawProjectId || 'bangonlocal';
const defaultAuthDomain = cleanEnvVar(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN) || `${resolvedProjectId}.firebaseapp.com`;

const firebaseConfig = {
  apiKey: cleanEnvVar(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: defaultAuthDomain,
  projectId: resolvedProjectId,
  storageBucket: cleanEnvVar(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: cleanEnvVar(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: cleanEnvVar(import.meta.env.VITE_FIREBASE_APP_ID),
};

console.log('[Firebase Init] config keys loaded:', Object.keys(firebaseConfig).reduce((acc, key) => {
  acc[key] = firebaseConfig[key as keyof typeof firebaseConfig] ? `Present (length ${firebaseConfig[key as keyof typeof firebaseConfig]?.length})` : 'Missing/Undefined';
  return acc;
}, {} as Record<string, string>));

const databaseId = cleanEnvVar(import.meta.env.VITE_FIREBASE_DATABASE_ID);

const app = initializeApp(firebaseConfig);

// Safe initialization for the default database vs custom multi-database IDs
export const db = (databaseId && databaseId !== 'default' && databaseId !== '(default)') 
  ? getFirestore(app, databaseId) 
  : getFirestore(app);
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
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
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
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
