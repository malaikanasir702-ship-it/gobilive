import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

(async () => {
  await mongoose.connect(process.env.MONGO_URI!);
  const db = mongoose.connection.db!;
  
  const total = await db.collection('users').countDocuments();
  console.log(`\nTotal users: ${total}`);

  // Find all admin roles
  const admins = await db.collection('users').find({
    role: { $in: ['company_admin','super_admin','sub_admin','agency','sub_agency','top_up_agent','reseller'] }
  }).project({ username: 1, email: 1, role: 1, tokenVersion: 1 }).toArray();

  console.log(`\nAdmin accounts (${admins.length}):`);
  admins.forEach((u: any) => {
    console.log(`  [${String(u.role).padEnd(15)}] ${u.email ?? '(no email)'}  @${u.username}  tv:${u.tokenVersion ?? 0}`);
  });

  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
