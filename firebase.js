import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAOPm63RaI_2Q_tOf-3rzS04qnNPurE2eM",
  authDomain: "rb-boxing.firebaseapp.com",
  projectId: "rb-boxing",
  storageBucket: "rb-boxing.firebasestorage.app",
  messagingSenderId: "581710602908",
  appId: "1:581710602908:web:9b46aa8ce0e84b9b2e8359"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use initializeFirestore with persistentLocalCache (replaces deprecated enableIndexedDbPersistence)
// Falls back gracefully if persistence is unavailable (e.g. private browsing)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
});
