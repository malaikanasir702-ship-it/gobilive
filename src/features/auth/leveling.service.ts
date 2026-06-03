import { User } from './user.model';

const XP_PER_DIAMOND_SPENT = 1;
const XP_PER_LEVEL = 500;

export function levelFromXp(xp: number): number {
  return Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1);
}

export async function addXp(userId: string, amount: number): Promise<{ level: number; xp: number }> {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  user.xp = (user.xp ?? 0) + amount;
  user.level = levelFromXp(user.xp);
  await user.save();

  return { level: user.level, xp: user.xp };
}

export async function addXpFromDiamondSpend(userId: string, diamonds: number) {
  return addXp(userId, diamonds * XP_PER_DIAMOND_SPENT);
}
