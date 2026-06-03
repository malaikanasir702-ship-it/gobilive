import dotenv from 'dotenv';
import { connectDB } from '../config/db';
import { ensureLiveDiscoverySeed } from '../features/live/live.seed';

dotenv.config();

(async () => {
  await connectDB();
  const created = await ensureLiveDiscoverySeed();
  console.log(created > 0 ? `Done. Created ${created} room(s).` : 'Active rooms already exist — nothing to seed.');
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
