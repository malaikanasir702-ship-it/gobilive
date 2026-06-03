import { OAuth2Client } from 'google-auth-library';
import { getAuth } from '../../config/firebase';
import { User } from './user.model';
import jwt from 'jsonwebtoken';

const generateToken = (userId: string, username: string, tokenVersion = 0): string =>
  jwt.sign(
    { id: userId, username, tokenVersion },
    process.env.JWT_SECRET || 'super_secret_gobilive_token_key_123!',
    { expiresIn: '30d' }
  );

export async function verifyFirebaseIdToken(idToken: string) {
  const auth = getAuth();
  if (!auth) throw new Error('Firebase Admin not configured.');
  return auth.verifyIdToken(idToken);
}

export async function verifyGoogleIdToken(idToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID not configured.');
  const client = new OAuth2Client(clientId);
  const ticket = await client.verifyIdToken({ idToken, audience: clientId });
  return ticket.getPayload();
}

export async function loginOrRegisterFromGoogleProfile(profile: {
  email?: string;
  name?: string;
  picture?: string;
  sub: string;
}) {
  const email = profile.email?.toLowerCase();
  let user = await User.findOne({
    $or: [{ googleId: profile.sub }, ...(email ? [{ email }] : [])],
  });

  if (!user) {
    const baseName = (profile.name || email?.split('@')[0] || 'user')
      .replace(/\W/g, '')
      .slice(0, 12)
      .toLowerCase();
    let username = baseName || 'user';
    let suffix = 1;
    while (await User.findOne({ username })) {
      username = `${baseName}${suffix++}`;
    }

    user = await User.create({
      username,
      email,
      googleId: profile.sub,
      authProvider: 'google',
      passwordHash: await hashRandomPassword(),
      profilePic: profile.picture || '',
      bio: 'Signed in with Google',
    });
  } else {
    if (!user.googleId) user.googleId = profile.sub;
    if (profile.picture && !user.profilePic) user.profilePic = profile.picture;
    await user.save();
  }

  const token = generateToken(user.id, user.username, user.tokenVersion ?? 0);
  return { token, user };
}

async function hashRandomPassword(): Promise<string> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.hash(`google_${Math.random().toString(36)}`, 10);
}

export async function loginWithFirebaseToken(idToken: string) {
  const decoded = await verifyFirebaseIdToken(idToken);
  return loginOrRegisterFromGoogleProfile({
    sub: decoded.uid,
    email: decoded.email,
    name: decoded.name,
    picture: decoded.picture,
  });
}

export async function loginWithGoogleToken(idToken: string) {
  const payload = await verifyGoogleIdToken(idToken);
  if (!payload?.sub) throw new Error('Invalid Google token.');
  return loginOrRegisterFromGoogleProfile({
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
  });
}
