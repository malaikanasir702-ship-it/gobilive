"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isFirebaseConfigured = isFirebaseConfigured;
exports.initFirebase = initFirebase;
exports.getMessaging = getMessaging;
exports.getAuth = getAuth;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
let initialized = false;
function isFirebaseConfigured() {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
        return true;
    const credPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
        process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (credPath && fs_1.default.existsSync(path_1.default.resolve(credPath)))
        return true;
    return false;
}
function initFirebase() {
    if (initialized)
        return true;
    if (!isFirebaseConfigured()) {
        console.warn('⚠️ Firebase Admin not configured — push notifications run in log-only mode.');
        return false;
    }
    try {
        if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
            firebase_admin_1.default.initializeApp({ credential: firebase_admin_1.default.credential.cert(serviceAccount) });
        }
        else {
            const credPath = path_1.default.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
                process.env.GOOGLE_APPLICATION_CREDENTIALS ||
                '');
            firebase_admin_1.default.initializeApp({ credential: firebase_admin_1.default.credential.cert(credPath) });
        }
        initialized = true;
        console.log('🔥 Firebase Admin initialized for FCM');
        return true;
    }
    catch (err) {
        console.error('Firebase Admin init failed:', err);
        return false;
    }
}
function getMessaging() {
    if (!initialized)
        initFirebase();
    return initialized ? firebase_admin_1.default.messaging() : null;
}
function getAuth() {
    if (!initialized)
        initFirebase();
    return initialized ? firebase_admin_1.default.auth() : null;
}
