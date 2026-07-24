"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyFirebaseIdToken = verifyFirebaseIdToken;
exports.verifyGoogleIdToken = verifyGoogleIdToken;
exports.loginOrRegisterFromGoogleProfile = loginOrRegisterFromGoogleProfile;
exports.loginWithFirebaseToken = loginWithFirebaseToken;
exports.loginWithGoogleToken = loginWithGoogleToken;
const google_auth_library_1 = require("google-auth-library");
const firebase_1 = require("../../config/firebase");
const user_model_1 = require("./user.model");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const generateToken = (userId, username, tokenVersion = 0) => jsonwebtoken_1.default.sign({ id: userId, username, tokenVersion }, process.env.JWT_SECRET || 'super_secret_gobilive_token_key_123!', { expiresIn: '30d' });
async function verifyFirebaseIdToken(idToken) {
    const auth = (0, firebase_1.getAuth)();
    if (!auth)
        throw new Error('Firebase Admin not configured.');
    return auth.verifyIdToken(idToken);
}
async function verifyGoogleIdToken(idToken) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId)
        throw new Error('GOOGLE_CLIENT_ID not configured.');
    const client = new google_auth_library_1.OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    return ticket.getPayload();
}
async function loginOrRegisterFromGoogleProfile(profile) {
    const email = profile.email?.toLowerCase();
    let user = await user_model_1.User.findOne({
        $or: [{ googleId: profile.sub }, ...(email ? [{ email }] : [])],
    });
    if (!user) {
        const baseName = (profile.name || email?.split('@')[0] || 'user')
            .replace(/\W/g, '')
            .slice(0, 12)
            .toLowerCase();
        let username = baseName || 'user';
        let suffix = 1;
        while (await user_model_1.User.findOne({ username })) {
            username = `${baseName}${suffix++}`;
        }
        user = await user_model_1.User.create({
            username,
            email,
            googleId: profile.sub,
            authProvider: 'google',
            passwordHash: await hashRandomPassword(),
            profilePic: profile.picture || '',
            bio: 'Signed in with Google',
        });
    }
    else {
        if (!user.googleId)
            user.googleId = profile.sub;
        if (profile.picture && !user.profilePic)
            user.profilePic = profile.picture;
        await user.save();
    }
    const token = generateToken(user.id, user.username, user.tokenVersion ?? 0);
    return { token, user };
}
async function hashRandomPassword() {
    const bcrypt = await Promise.resolve().then(() => __importStar(require('bcryptjs')));
    return bcrypt.hash(`google_${Math.random().toString(36)}`, 10);
}
async function loginWithFirebaseToken(idToken) {
    const decoded = await verifyFirebaseIdToken(idToken);
    return loginOrRegisterFromGoogleProfile({
        sub: decoded.uid,
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
    });
}
async function loginWithGoogleToken(idToken) {
    const payload = await verifyGoogleIdToken(idToken);
    if (!payload?.sub)
        throw new Error('Invalid Google token.');
    return loginOrRegisterFromGoogleProfile({
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
    });
}
