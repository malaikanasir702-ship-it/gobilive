/**
 * seed-admin-users.ts
 * Creates one demo user per admin role if they don't already exist.
 * Safe to run multiple times — skips existing emails.
 *
 * Run locally:
 *   npx ts-node src/scripts/seed-admin-users.ts
 */

import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db';
import { User, UserRole } from '../features/auth/user.model';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface SeedUser {
  username: string;
  email: string;
  password: string;
  role: UserRole;
}

const SEED_USERS: SeedUser[] = [
  { username: 'company_admin',  email: 'company_admin@globilive.com',  password: 'CA#Gl0b!2025',   role: 'company_admin'  },
  { username: 'super_admin1',   email: 'super_admin@globilive.com',    password: 'SA#Gl0b!2025',   role: 'super_admin'    },
  { username: 'sub_admin1',     email: 'sub_admin@globilive.com',      password: 'SubA#Gl0b!2025', role: 'sub_admin'      },
  { username: 'agency1',        email: 'agency@globilive.com',         password: 'Ag#Gl0b!2025',   role: 'agency'         },
  { username: 'sub_agency1',    email: 'sub_agency@globilive.com',     password: 'SbAg#Gl0b!2025', role: 'sub_agency'     },
  { username: 'top_up_agent1',  email: 'topupagent@globilive.com',     password: 'TUA#Gl0b!2025',  role: 'top_up_agent'   },
  { username: 'reseller1',      email: 'reseller@globilive.com',       password: 'RS#Gl0b!2025',   role: 'reseller'       },
];

(async () => {
  await connectDB();

  console.log('\n🌱 Re-seeding admin users (delete old → create new)...\n');

  const oldEmails = [
    'company_admin@gobilive.com',
    'super_admin@gobilive.com',
    'sub_admin@gobilive.com',
    'agency@gobilive.com',
    'sub_agency@gobilive.com',
    'topupagent@gobilive.com',
    'reseller@gobilive.com',
  ];

  // Delete old seed accounts
  const deleted = await User.deleteMany({ email: { $in: oldEmails } });
  console.log(`🗑  Deleted ${deleted.deletedCount} old seed account(s)\n`);

  for (const u of SEED_USERS) {
    const exists = await User.findOne({ email: u.email });
    if (exists) {
      // Update password + bump tokenVersion to invalidate all existing JWTs
      const passwordHash = await bcrypt.hash(u.password, 10);
      await User.findByIdAndUpdate(exists._id, {
        passwordHash,
        $inc: { tokenVersion: 1 },
      });
      console.log(`🔄 Updated  [${u.role.padEnd(15)}] ${u.email}  — password reset, sessions invalidated`);
      continue;
    }

    const passwordHash = await bcrypt.hash(u.password, 10);
    await User.create({
      username: u.username,
      email: u.email,
      passwordHash,
      role: u.role,
      authProvider: 'local',
      beanWallet: 0,
      isBlocked: false,
      isTerminated: false,
      isSuspended: false,
      tokenVersion: 1,
    });

    console.log(`✅ Created  [${u.role.padEnd(15)}] ${u.email}  password: ${u.password}`);
  }

  console.log('\n✔  Done.\n');
  process.exit(0);
})().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
