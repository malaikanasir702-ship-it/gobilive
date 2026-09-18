/**
 * restore-users-from-firebase.ts
 *
 * Restores all user accounts from Firebase Authentication back into MongoDB Atlas.
 * Preserves original signup timestamps, emails, display names, profile pics, and Firebase UIDs.
 * Safe to run multiple times (skips already existing users).
 *
 * Usage:
 *   npx ts-node src/scripts/restore-users-from-firebase.ts
 */

import dns from 'dns';
// Ensure reliable DNS resolution for MongoDB Atlas SRV connection strings
dns.setServers(['8.8.8.8', '1.1.1.1']);

import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import admin from 'firebase-admin';
import fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
  console.log('====================================================');
  console.log('🔄 GOBILIVE USER RESTORATION FROM FIREBASE AUTH');
  console.log('====================================================\n');

  // 1. Initialize Firebase Admin
  const serviceAccountPath = path.resolve(__dirname, '../../firebase-service-account.json');
  if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ firebase-service-account.json not found at:', serviceAccountPath);
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('🔥 Firebase Admin connected for project:', serviceAccount.project_id);

  // 2. Connect to MongoDB Atlas
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ MONGO_URI not found in environment variables.');
    process.exit(1);
  }

  console.log('📦 Connecting to MongoDB Atlas...');
  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 20000,
  });
  const db = mongoose.connection.db!;
  const usersCollection = db.collection('users');
  console.log('✅ MongoDB connected to database:', db.databaseName);

  const currentCount = await usersCollection.countDocuments();
  console.log(`📊 Current users in MongoDB: ${currentCount}\n`);

  // 3. Fetch all users from Firebase Auth
  console.log('📥 Fetching users from Firebase Auth...');
  const listUsersResult = await admin.auth().listUsers(1000);
  const firebaseUsers = listUsersResult.users;
  console.log(`✨ Total users found in Firebase Auth: ${firebaseUsers.length}\n`);

  let restoredCount = 0;
  let skippedCount = 0;

  for (const fUser of firebaseUsers) {
    const email = fUser.email ? fUser.email.toLowerCase().trim() : undefined;
    const uid = fUser.uid;

    // Check if user already exists by googleId or email
    const queryConditions: any[] = [{ googleId: uid }];
    if (email) {
      queryConditions.push({ email });
    }

    const existingUser = await usersCollection.findOne({ $or: queryConditions });

    if (existingUser) {
      console.log(`⏭️  Skipping (already exists): ${email || uid} (username: ${existingUser.username})`);
      skippedCount++;
      continue;
    }

    // Generate unique username
    const rawName = fUser.displayName || email?.split('@')[0] || 'user';
    const baseName = rawName.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 12).toLowerCase() || 'user';
    
    let username = baseName;
    let suffix = 1;
    while (await usersCollection.findOne({ username })) {
      username = `${baseName}${suffix++}`;
    }

    // Default password hash for OAuth users
    const randomPass = `firebase_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    const passwordHash = await bcrypt.hash(randomPass, 10);

    const createdAt = fUser.metadata.creationTime ? new Date(fUser.metadata.creationTime) : new Date();
    const now = new Date();

    const newUserDoc = {
      username,
      displayName: fUser.displayName || undefined,
      email: email || undefined,
      phone: fUser.phoneNumber || undefined,
      passwordHash,
      googleId: uid,
      authProvider: 'google',
      twoFactorEnabled: false,
      bio: 'Hey there! I am using GlobiLive.',
      profilePic: fUser.photoURL || '',
      level: 1,
      xp: 0,
      diamonds: 0,
      rcoins: 0,
      beanWallet: 0,
      currentWallet: 0,
      rewardWallet: 0,
      isVIP: false,
      vipFrame: '',
      badges: [],
      fcmTokens: [],
      followersCount: 0,
      followingCount: 0,
      friendsCount: 0,
      likesCount: 0,
      role: 'user',
      isBlocked: false,
      isTerminated: false,
      isSuspended: false,
      tokenVersion: 0,
      isPrivate: false,
      storyPrivacy: 'everyone',
      notificationPrefs: {
        messages: true,
        calls: true,
        gifts: true,
        follows: true,
        liveAlerts: true,
      },
      blockedUsers: [],
      searchHistory: [],
      hiddenCreators: [],
      purchasedFrames: [],
      createdAt,
      updatedAt: now,
    };

    await usersCollection.insertOne(newUserDoc);
    console.log(`✅ Restored: [${username.padEnd(14)}] ${email || 'No email'} (UID: ${uid})`);
    restoredCount++;
  }

  const finalCount = await usersCollection.countDocuments();

  console.log('\n====================================================');
  console.log('🎉 RESTORATION COMPLETED!');
  console.log(`✨ Total Restored:   ${restoredCount}`);
  console.log(`⏭️  Already Existed:  ${skippedCount}`);
  console.log(`📈 Final User Count: ${finalCount}`);
  console.log('====================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Restoration failed:', err);
  process.exit(1);
});
