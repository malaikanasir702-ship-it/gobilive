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
  { username: 'company_admin',  email: 'company_admin@gobilive.com',  password: 'Admin@1234',  role: 'company_admin'  },
  { username: 'super_admin1',   email: 'super_admin@gobilive.com',    password: 'Admin@1234',  role: 'super_admin'    },
  { username: 'sub_admin1',     email: 'sub_admin@gobilive.com',      password: 'Admin@1234',  role: 'sub_admin'      },
  { username: 'agency1',        email: 'agency@gobilive.com',         password: 'Admin@1234',  role: 'agency'         },
  { username: 'sub_agency1',    email: 'sub_agency@gobilive.com',     password: 'Admin@1234',  role: 'sub_agency'     },
  { username: 'top_up_agent1',  email: 'topupagent@gobilive.com',     password: 'Admin@1234',  role: 'top_up_agent'   },
  { username: 'reseller1',      email: 'reseller@gobilive.com',       password: 'Admin@1234',  role: 'reseller'       },
];

(async () => {
  await connectDB();

  console.log('\n🌱 Seeding admin users...\n');

  for (const u of SEED_USERS) {
    const exists = await User.findOne({ email: u.email });
    if (exists) {
      console.log(`⏭  Skipped  [${u.role.padEnd(15)}] ${u.email} — already exists`);
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
      tokenVersion: 0,
    });

    console.log(`✅ Created  [${u.role.padEnd(15)}] ${u.email}  password: ${u.password}`);
  }

  console.log('\n✔  Done.\n');
  process.exit(0);
})().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
