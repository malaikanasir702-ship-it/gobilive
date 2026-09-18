import dotenv from 'dotenv';
import path from 'path';
import { connectDB } from '../config/db';
import { User } from '../features/auth/user.model';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

(async () => {
  await connectDB();
  const users = await User.find({ email: /@globilive\.com$/ })
    .select('username email role createdAt tokenVersion')
    .lean();
  console.log(`\nFound ${users.length} globilive.com accounts:\n`);
  users.forEach((u: any) => {
    console.log(`  [${u.role.padEnd(15)}] ${u.email}  (tokenVersion: ${u.tokenVersion})`);
  });
  console.log('');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
