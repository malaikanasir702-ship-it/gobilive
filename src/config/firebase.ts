import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

let initialized = false;

export function isFirebaseConfigured(): boolean {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return true;
  const credPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath && fs.existsSync(path.resolve(credPath))) return true;
  return false;
}

export function initFirebase(): boolean {
  if (initialized) return true;
  if (!isFirebaseConfigured()) {
    console.warn('⚠️ Firebase Admin not configured — push notifications run in log-only mode.');
    return false;
  }

  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } else {
      const credPath = path.resolve(
        process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
          process.env.GOOGLE_APPLICATION_CREDENTIALS ||
          ''
      );
      admin.initializeApp({ credential: admin.credential.cert(credPath) });
    }
    initialized = true;
    console.log('🔥 Firebase Admin initialized for FCM');
    return true;
  } catch (err) {
    console.error('Firebase Admin init failed:', err);
    return false;
  }
}

export function getMessaging() {
  if (!initialized) initFirebase();
  return initialized ? admin.messaging() : null;
}

export function getAuth() {
  if (!initialized) initFirebase();
  return initialized ? admin.auth() : null;
}
