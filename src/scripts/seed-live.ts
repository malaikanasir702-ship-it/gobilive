import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import { connectDB } from '../config/db';
import { ensureLiveDiscoverySeed } from '../features/live/live.seed';

(async () => {
  await connectDB();
  const created = await ensureLiveDiscoverySeed();
  console.log(created > 0 ? `Done. Created ${created} room(s).` : 'Active rooms already exist — nothing to seed.');
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
