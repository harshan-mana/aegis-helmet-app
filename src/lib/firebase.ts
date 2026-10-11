import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, OAuthProvider, signInWithPopup, onAuthStateChanged, User, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Always use the Firebase auth domain - authorized domains are managed in Firebase Console.
// Guard against duplicate initialisation: a second initializeApp call throws
// "[DEFAULT] already exists", and a duplicate App means two Auth instances where
// the one we configure persistence on may not be the one used for sign-in.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const appleProvider = new OAuthProvider('apple.com');

// Enable Firebase Auth
try {
  auth.useDeviceLanguage();
} catch (e) {
  console.warn('Firebase auth init warning:', e);
}

/**
 * Resolves once persistence has been applied to THIS auth instance.
 * browserLocalPersistence stores the session in localStorage so a page refresh or
 * browser restart restores the user instead of showing the sign-in screen.
 * Sign-in flows await this before calling signInWith* so persistence is
 * guaranteed to be applied to the same instance used for sign-in.
 */
export const authPersistenceReady: Promise<void> = (async () => {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (e) {
    console.warn('Firebase persistence warning:', e);
  }
})();

// Session is considered expired after 7 days of inactivity
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
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
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}
