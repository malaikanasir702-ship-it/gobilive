/**
 * restore-registrations-from-resend.ts
 *
 * Fetches all registration approval emails from Resend,
 * parses full names, roles, usernames, and emails,
 * and restores them into MongoDB Atlas (both RegistrationRequest and User accounts).
 */

import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Resend } from 'resend';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const resend = new Resend(RESEND_API_KEY);

function normalizeRole(roleStr: string): string {
  const r = roleStr.toLowerCase().replace(/[^a-z_]/g, '_').trim();
  if (r.includes('sub_admin')) return 'sub_admin';
  if (r.includes('super_admin')) return 'super_admin';
  if (r.includes('company_admin')) return 'company_admin';
  if (r.includes('agency') && !r.includes('sub_agency')) return 'agency';
  if (r.includes('sub_agency')) return 'sub_agency';
  if (r.includes('top_up') || r.includes('topup')) return 'top_up_agent';
  if (r.includes('reseller')) return 'reseller';
  if (r.includes('host')) return 'host';
  return 'user';
}

async function main() {
  console.log('====================================================');
  console.log('📬 RESTORING REGISTRATION REQUESTS FROM RESEND');
  console.log('====================================================\n');

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGO_URI not found');
    process.exit(1);
  }

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 20000 });
  const db = mongoose.connection.db!;
  const regCol = db.collection('registrationrequests');
  const userCol = db.collection('users');

  console.log('✅ Connected to MongoDB Atlas');

  console.log('📥 Fetching emails list from Resend...');
  const listRes = await resend.emails.list();
  const emails = (listRes.data as any)?.data || listRes.data || [];
  console.log(`✨ Total emails found in Resend: ${emails.length}\n`);

  let restoredRequests = 0;
  let updatedUsers = 0;

  for (const item of emails) {
    const subject = item.subject || '';
    if (!subject.toLowerCase().includes('registration') && !subject.toLowerCase().includes('approved')) {
      continue;
    }

    console.log(`\n🔍 Fetching details for email to ${item.to} (Subject: "${subject}")...`);
    const detailRes = await resend.emails.get(item.id);
    const detail = detailRes.data;
    if (!detail) continue;

    const emailTo = (Array.isArray(detail.to) ? detail.to[0] : detail.to)?.toLowerCase()?.trim();
    const content = (detail.text || detail.html || '') as string;
    const createdAt = new Date(item.created_at || detail.created_at);

    // Extract Name: "Hi MUHAMMAD IMTIAZ SIDDIQ,"
    const nameMatch = content.match(/Hi\s+([A-Za-z0-9\s_]+?)[,\n<]/i);
    const fullName = nameMatch ? nameMatch[1].trim() : 'Applicant';

    // Extract Role: "Your Sub Admin registration" or "Role\s*[\n<]+([A-Za-z\s_]+)"
    let roleStr = '';
    const roleMatch1 = content.match(/Your\s+([A-Za-z\s_]+?)\s+registration/i);
    const roleMatch2 = content.match(/Role\s*[\r\n\t<]+([A-Za-z\s_]+?)[\r\n<]/i);
    if (roleMatch1) roleStr = roleMatch1[1].trim();
    else if (roleMatch2) roleStr = roleMatch2[1].trim();
    else roleStr = 'host';

    const role = normalizeRole(roleStr);

    // Extract Username: "Username\s*[\n<]+@?([A-Za-z0-9_]+)"
    const userMatch = content.match(/Username\s*[\r\n\t<]+@?([A-Za-z0-9_]+)/i);
    const username = userMatch ? userMatch[1].trim().toLowerCase() : fullName.replace(/\W/g, '_').toLowerCase();

    // Extract Password if present
    const passMatch = content.match(/Password\s*[\r\n\t<]+([^\r\n<]+)/i);
    const rawPass = passMatch ? passMatch[1].trim() : 'Gobilive@123';

    console.log(`📋 Found: Name="${fullName}", Email="${emailTo}", Role="${role}", Username="${username}"`);

    // 1. Insert or Update RegistrationRequest
    const existingReq = await regCol.findOne({
      $or: [
        { 'formData.email': emailTo },
        { 'formData.fullName': fullName, role },
      ],
    });

    if (!existingReq) {
      await regCol.insertOne({
        role,
        status: 'approved',
        formData: {
          fullName,
          email: emailTo,
          parentId: undefined,
        },
        documentUrls: [],
        createdAt,
        reviewedAt: createdAt,
        updatedAt: new Date(),
      });
      console.log(`  ✅ Inserted RegistrationRequest for ${fullName} (${role})`);
      restoredRequests++;
    } else {
      console.log(`  ⏭️  RegistrationRequest already exists for ${emailTo}`);
    }

    // 2. Ensure User exists and has the correct role
    const existingUser = await userCol.findOne({
      $or: [
        { email: emailTo },
        { username },
      ],
    });

    const passwordHash = await bcrypt.hash(rawPass, 10);

    if (existingUser) {
      // Update role to approved role (e.g. sub_admin, agency, host)
      await userCol.updateOne(
        { _id: existingUser._id },
        {
          $set: {
            role,
            displayName: fullName,
            passwordHash, // update with their email password so they can log in!
            updatedAt: new Date(),
          },
        }
      );
      console.log(`  👤 Updated existing User (${existingUser.username}) to role "${role}"`);
      updatedUsers++;
    } else {
      // Create new user account with approved role and credentials!
      await userCol.insertOne({
        username,
        displayName: fullName,
        email: emailTo,
        passwordHash,
        authProvider: 'local',
        twoFactorEnabled: false,
        bio: `${role} on GobiLive`,
        profilePic: '',
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
        role,
        isBlocked: false,
        isTerminated: false,
        isSuspended: false,
        tokenVersion: 1,
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
        updatedAt: new Date(),
      });
      console.log(`  🎉 Created new User account for ${username} with role "${role}"`);
      updatedUsers++;
    }
  }

  const finalReqCount = await regCol.countDocuments();
  console.log('\n====================================================');
  console.log('🎉 REGISTRATIONS RESTORATION COMPLETED!');
  console.log(`✨ Restored Requests:      ${restoredRequests}`);
  console.log(`👥 Updated/Created Users:  ${updatedUsers}`);
  console.log(`📊 Total In Database:      ${finalReqCount}`);
  console.log('====================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Error during restoration:', err);
  process.exit(1);
});
