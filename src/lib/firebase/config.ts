import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

function getFirebaseConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
}

function isFirebaseConfigured(): boolean {
  const config = getFirebaseConfig();
  return !!config.apiKey && !!config.authDomain && !!config.projectId && !!config.storageBucket && !!config.messagingSenderId && !!config.appId;
}

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;

function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured. Please set the required environment variables.");
  }
  if (!app) {
    app = initializeApp(getFirebaseConfig());
  }
  return app;
}

export function getAuthInstance(): Auth {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured. Please set the required environment variables.");
  }
  if (!authInstance) {
    authInstance = getAuth(getFirebaseApp());
  }
  return authInstance;
}

export function getFirestoreInstance(): Firestore {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured. Please set the required environment variables.");
  }
  if (!dbInstance) {
    dbInstance = getFirestore(getFirebaseApp());
  }
  return dbInstance;
}

export function getStorageInstance(): FirebaseStorage {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured. Please set the required environment variables.");
  }
  if (!storageInstance) {
    storageInstance = getStorage(getFirebaseApp());
  }
  return storageInstance;
}

export function isFirebaseReady(): boolean {
  return isFirebaseConfigured();
}

export { app };
