export interface GiftItem {
  id: string;
  name: string;
  emoji: string;
  diamondCost: number;
  rcoinEarned: number;
  isVipOnly: boolean;
  animation: string;
  giftType?: 'emoji' | 'svga' | 'animated';
}

// ─── Emoji gifts (lightweight, always available) ──────────────────────────
export const GIFT_CATALOG: GiftItem[] = [
  { id: 'heart',   name: 'Heart',   emoji: '💖', diamondCost: 10,   rcoinEarned: 1,   isVipOnly: false, animation: 'pulse',   giftType: 'emoji' },
  { id: 'thumbs',  name: 'Thumbs',  emoji: '👍', diamondCost: 5,    rcoinEarned: 0,   isVipOnly: false, animation: 'float',   giftType: 'emoji' },
  { id: 'fire',    name: 'Fire',    emoji: '🔥', diamondCost: 25,   rcoinEarned: 2,   isVipOnly: false, animation: 'float',   giftType: 'emoji' },
  { id: 'star',    name: 'Star',    emoji: '⭐', diamondCost: 50,   rcoinEarned: 5,   isVipOnly: false, animation: 'sparkle', giftType: 'emoji' },
  { id: 'dragon',  name: 'Dragon',  emoji: '🐉', diamondCost: 5000, rcoinEarned: 500, isVipOnly: true,  animation: 'epic',    giftType: 'emoji' },
];

// ─── Built-in Flutter animated gifts (no file needed — pure Flutter animation) ─
export const ANIMATED_GIFT_CATALOG: GiftItem[] = [
  {
    id: 'rose',
    name: 'Rose Shower',
    emoji: '🌹',
    diamondCost: 99,
    rcoinEarned: 10,
    isVipOnly: false,
    animation: 'animated',
    giftType: 'animated',
  },
  {
    id: 'lion',
    name: 'Roaring Lion',
    emoji: '🦁',
    diamondCost: 299,
    rcoinEarned: 30,
    isVipOnly: false,
    animation: 'animated',
    giftType: 'animated',
  },
  {
    id: 'car',
    name: 'Speed Car',
    emoji: '🚗',
    diamondCost: 499,
    rcoinEarned: 50,
    isVipOnly: false,
    animation: 'animated',
    giftType: 'animated',
  },
  {
    id: 'diamond',
    name: 'Diamond Rain',
    emoji: '💎',
    diamondCost: 999,
    rcoinEarned: 100,
    isVipOnly: false,
    animation: 'animated',
    giftType: 'animated',
  },
  {
    id: 'rocket',
    name: 'Galaxy Rocket',
    emoji: '🚀',
    diamondCost: 1499,
    rcoinEarned: 150,
    isVipOnly: false,
    animation: 'animated',
    giftType: 'animated',
  },
  {
    id: 'crown',
    name: 'Royal Crown',
    emoji: '👑',
    diamondCost: 2999,
    rcoinEarned: 300,
    isVipOnly: false,
    animation: 'animated',
    giftType: 'animated',
  },
];

// Combined catalog for lookup
export const ALL_GIFTS = [...GIFT_CATALOG, ...ANIMATED_GIFT_CATALOG];

export function getGiftById(giftId: string): GiftItem | undefined {
  return ALL_GIFTS.find((g) => g.id === giftId);
}
