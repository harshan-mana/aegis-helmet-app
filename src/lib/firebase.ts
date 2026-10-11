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
// Always ask Google WHICH account to use instead of silently reusing the
// previously signed-in one. Without this, after signing out of AEGIS the next
// "Sign in with Google" silently re-authenticates the last Google account.
//
// Applied to THIS exported singleton, which is the exact instance passed to
// signInWithPopup() by both AuthModal and LandingPage, so the setting can
// never be lost by using a different provider object.
//
// This only affects which AEGIS/Firebase account is used. It does NOT sign the
// user out of Google or any other Google service (revokeAccessToken is never
// called), and Google's own page still handles any password entry.
googleProvider.setCustomParameters({ prompt: 'select_account' });

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
