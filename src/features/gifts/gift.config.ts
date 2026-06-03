export interface GiftItem {
  id: string;
  name: string;
  emoji: string;
  diamondCost: number;
  rcoinEarned: number;
  isVipOnly: boolean;
  animation: string;
}

export const GIFT_CATALOG: GiftItem[] = [
  { id: 'rose', name: 'Rose', emoji: '🌹', diamondCost: 50, rcoinEarned: 5, isVipOnly: false, animation: 'float' },
  { id: 'heart', name: 'Heart', emoji: '💖', diamondCost: 100, rcoinEarned: 10, isVipOnly: false, animation: 'pulse' },
  { id: 'crown', name: 'Crown', emoji: '👑', diamondCost: 500, rcoinEarned: 50, isVipOnly: false, animation: 'sparkle' },
  { id: 'rocket', name: 'Rocket', emoji: '🚀', diamondCost: 1000, rcoinEarned: 100, isVipOnly: false, animation: 'fly' },
  { id: 'dragon', name: 'Dragon', emoji: '🐉', diamondCost: 5000, rcoinEarned: 500, isVipOnly: true, animation: 'epic' },
];

export function getGiftById(giftId: string): GiftItem | undefined {
  return GIFT_CATALOG.find((g) => g.id === giftId);
}
