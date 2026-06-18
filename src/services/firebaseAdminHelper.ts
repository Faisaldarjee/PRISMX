import { getApps, initializeApp, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

let firebaseConfig: any = null;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (e) {
  console.warn('[FirebaseAdminHelper] Failed to read firebase-applet-config.json:', e);
}

/**
 * Clean quotes and whitespace from environment variables
 */
function cleanEnvValue(val: string | undefined): string {
  if (!val) return '';
  let trimmed = val.trim();
  while (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.substring(1, trimmed.length - 1);
  }
  return trimmed.trim();
}

/**
 * Safe initializer for firebase-admin to automatically resolve
 * the correct GCP Project ID on Cloud Run or fall back appropriately.
 */
export function initializeFirebaseAdmin(): App {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    return existingApps[0];
  }

  const gcpProj = cleanEnvValue(process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT);
  const firebaseProj = cleanEnvValue(process.env.VITE_FIREBASE_PROJECT_ID);

  // Prioritize active GCP container project ID (gcpProj) to avoid authorization mismatches in Cloud Run preview,
  // then fallback to firebaseConfig projectId (e.g. on Render) or VITE_FIREBASE_PROJECT_ID
  const projectId = gcpProj || (firebaseConfig && firebaseConfig.projectId) || firebaseProj || 'prismlocal';

  console.log(`[FirebaseAdminHelper] Detected GCP Project ID: "${gcpProj}", Config VITE_FIREBASE_PROJECT_ID: "${firebaseProj}"`);
  console.log(`[FirebaseAdminHelper] Attempting to initialize with Project ID: "${projectId}"`);

  // If the target project ID is a local placeholder, or if we have authorization issues,
  // we try to let firebase-admin automatically auto-discover the running environment credentials.
  if (projectId === 'bangonlocal' || projectId === 'prismlocal') {
    if (gcpProj) {
      return initializeApp({ projectId: gcpProj });
    } else {
      try {
        console.log('[FirebaseAdminHelper] Using default Application Default Credentials auto-discovery...');
        return initializeApp();
      } catch (err: any) {
        console.warn('[FirebaseAdminHelper] Default discovery failed, falling back to:', projectId, err.message);
        return initializeApp({ projectId });
      }
    }
  }

  return initializeApp({ projectId });
}

/**
 * Returns the Firestore admin instance configured with custom database ID helper if available
 */
export function getFirestoreAdmin(): Firestore {
  const app = initializeFirebaseAdmin();
  const databaseId = firebaseConfig?.firestoreDatabaseId;
  if (databaseId && databaseId !== 'default' && databaseId !== '(default)') {
    console.log(`[FirebaseAdminHelper] Using Firestore with custom databaseId: "${databaseId}"`);
    return getFirestore(app, databaseId);
  }
  return getFirestore(app);
}
