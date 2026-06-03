import bcrypt from 'bcryptjs';
import LiveRoom from './live.model';
import { User } from '../auth/user.model';

const SEED_CREATORS = [
  {
    username: 'pro_gamer_x',
    title: 'Climbing the ranks in Valorant',
    category: 'Gaming',
    hostLevel: 15,
    viewerCount: 230,
  },
  {
    username: 'luna_vibes',
    title: 'Creator Spotlight — Dance hour',
    category: 'Dance',
    hostLevel: 22,
    viewerCount: 1300,
  },
  {
    username: 'nova_beats',
    title: 'Late Night Mix Live',
    category: 'Music',
    hostLevel: 18,
    viewerCount: 892,
  },
  {
    username: 'chill_chat_host',
    title: 'Open mic & vibes tonight',
    category: 'Chat',
    hostLevel: 9,
    viewerCount: 156,
  },
] as const;

/**
 * Inserts demo live rooms when the database has none (dev / first run).
 */
export async function ensureLiveDiscoverySeed(): Promise<number> {
  const activeCount = await LiveRoom.countDocuments({
    isActive: true,
    privacyMode: { $ne: 'private' },
  });
  if (activeCount > 0) return 0;

  const passwordHash = await bcrypt.hash('gobilive_seed_only', 10);
  let created = 0;

  for (const seed of SEED_CREATORS) {
    let user = await User.findOne({ username: seed.username });
    if (!user) {
      user = await User.create({
        username: seed.username,
        email: `${seed.username}@gobilive.seed`,
        passwordHash,
        authProvider: 'local',
        level: seed.hostLevel,
        bio: 'Gobilive demo creator',
      });
    }

    const channelName = `seed_${seed.username}`;
    const exists = await LiveRoom.findOne({ channelName });
    if (exists) continue;

    await LiveRoom.create({
      channelName,
      hostId: user._id,
      hostUsername: seed.username,
      hostLevel: seed.hostLevel,
      title: seed.title,
      category: seed.category,
      privacyMode: 'public',
      isActive: true,
      viewerCount: seed.viewerCount,
      peakViewers: seed.viewerCount,
    });
    created += 1;
  }

  if (created > 0) {
    console.log(`🌱 Seeded ${created} demo live room(s) for discovery feed.`);
  }
  return created;
}
