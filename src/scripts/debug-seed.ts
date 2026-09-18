import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

(async () => {
  console.log('MONGO_URI:', process.env.MONGO_URI?.substring(0, 50) + '...');
  
  await mongoose.connect(process.env.MONGO_URI!);
  console.log('Connected to DB:', mongoose.connection.name);

  const db = mongoose.connection.db!;
  
  // Count all users
  const total = await db.collection('users').countDocuments();
  console.log(`Total users in DB: ${total}`);

  // Find globilive accounts
  const globiUsers = await db.collection('users').find(
    { email: { $regex: '@globilive\\.com$' } }
  ).project({ username: 1, email: 1, role: 1 }).toArray();
  
  console.log(`\nglobilive.com accounts found: ${globiUsers.length}`);
  globiUsers.forEach(u => console.log(`  ${u.email} — ${u.role}`));

  // Check recently created
  const recent = await db.collection('users').find({})
    .sort({ createdAt: -1 })
    .limit(10)
    .project({ username: 1, email: 1, role: 1, createdAt: 1 })
    .toArray();
  
  console.log('\nLast 10 created users:');
  recent.forEach(u => console.log(`  ${u.email} | ${u.role} | ${u.createdAt}`));

  process.exit(0);
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
