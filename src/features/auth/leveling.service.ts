import { User } from './user.model';

const XP_PER_DIAMOND_SPENT = 1;
const XP_PER_LEVEL = 500;

export function levelFromXp(xp: number): number {
  return Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1);
}

export async function addXp(userId: string, amount: number): Promise<{ level: number; xp: number }> {
  // Use $inc to atomically increment xp without triggering full-document schema validation
  const user = await User.findById(userId).select('xp level').lean();
  if (!user) throw new Error('User not found');

  const newXp = (user.xp ?? 0) + amount;
  const newLevel = levelFromXp(newXp);

  await User.updateOne(
    { _id: userId },
    { $set: { xp: newXp, level: newLevel } }
  );

  return { level: newLevel, xp: newXp };
}

export async function addXpFromDiamondSpend(userId: string, diamonds: number) {
  return addXp(userId, diamonds * XP_PER_DIAMOND_SPENT);
}
