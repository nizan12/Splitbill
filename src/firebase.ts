import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  getDocFromServer,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

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
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export async function signInWithGoogle(): Promise<User | null> {
  const isMobile =
    typeof window !== 'undefined' &&
    /Mobi|Android|iPhone|iPad|iPod|Line|Instagram|FBAN|FBAV|WhatsApp/i.test(
      navigator.userAgent
    );

  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    const code = error?.code || '';
    const message = error?.message || '';

    // If popup was blocked by browser or is in a mobile/in-app webview
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/cancelled-popup-request' ||
      message.includes('popup') ||
      isMobile
    ) {
      console.warn('Popup login terblokir di HP. Mengalihkan ke mode Redirect...');
      await signInWithRedirect(auth, googleProvider);
      return null;
    }

    throw error;
  }
}

// Automatically resolve redirect login result on page load
if (typeof window !== 'undefined') {
  getRedirectResult(auth).catch((err) => {
    console.warn('Redirect login error:', err);
  });
}

export async function logoutGoogle(): Promise<void> {
  await signOut(auth);
}

export async function syncUserProfileToFirestore(user: User) {
  const path = `users/${user.uid}`;
  try {
    await setDoc(
      doc(db, 'users', user.uid),
      {
        uid: user.uid,
        displayName: (user.displayName || 'Pengguna').slice(0, 120),
        email: (user.email || '').slice(0, 180),
        photoURL: (user.photoURL || '').slice(0, 500),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncBillMetadataToFirestore(params: {
  id: string;
  ownerId: string;
  ownerEmail?: string;
  title: string;
  category: string;
  date: string;
  creatorName: string;
  grandTotal: number;
  paidCount: number;
  participantCount: number;
}) {
  const path = `bills/${params.id}`;
  try {
    await setDoc(
      doc(db, 'bills', params.id),
      {
        id: params.id.slice(0, 100),
        ownerId: params.ownerId,
        ownerEmail: (params.ownerEmail || '').slice(0, 180),
        title: (params.title || 'Tagihan Split Bill').slice(0, 200),
        category: (params.category || 'Makan & Minum').slice(0, 80),
        date: (params.date || new Date().toISOString().slice(0, 10)).slice(0, 40),
        creatorName: (params.creatorName || '').slice(0, 120),
        grandTotal: Math.max(0, Math.round(params.grandTotal || 0)),
        paidCount: Math.max(0, Math.round(params.paidCount || 0)),
        participantCount: Math.max(0, Math.round(params.participantCount || 0)),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteBillFromFirestore(billId: string) {
  const path = `bills/${billId}`;
  try {
    await deleteDoc(doc(db, 'bills', billId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export { onAuthStateChanged };
export type { User };
