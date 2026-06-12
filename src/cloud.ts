import { initializeApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import {
  doc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isCloudConfigured = Object.values(firebaseConfig).every(Boolean)

const app = isCloudConfigured ? initializeApp(firebaseConfig) : null
const auth = app ? getAuth(app) : null
const db = app ? getFirestore(app) : null

export function observeUser(callback: (user: User | null) => void) {
  if (!auth) {
    callback(null)
    return () => undefined
  }
  return onAuthStateChanged(auth, callback)
}

export async function loginWithGoogle() {
  if (!auth) throw new Error('Firebaseが設定されていません。')
  return signInWithPopup(auth, new GoogleAuthProvider())
}

export async function logoutCloud() {
  if (auth) await signOut(auth)
}

export function observeCloudItems(
  uid: string,
  callback: (items: unknown[] | null) => void,
  onError: (error: Error) => void,
) {
  if (!db) return () => undefined
  return onSnapshot(
    doc(db, 'users', uid, 'data', 'main'),
    (snapshot) => callback(snapshot.exists() ? (snapshot.data().items as unknown[] ?? []) : null),
    onError,
  )
}

export async function saveCloudItems(uid: string, items: unknown[]) {
  if (!db) return
  await setDoc(doc(db, 'users', uid, 'data', 'main'), {
    items,
    updatedAt: serverTimestamp(),
  })
}
