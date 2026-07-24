"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_GIFTS = exports.GIFT_CATALOG = void 0;
exports.getGiftById = getGiftById;
// ─── Emoji gifts (lightweight, always available) ──────────────────────────────
exports.GIFT_CATALOG = [
    { id: 'heart', name: 'Heart', emoji: '💖', diamondCost: 10, rcoinEarned: 1, isVipOnly: false, animation: 'pulse', giftType: 'emoji' },
    { id: 'thumbs', name: 'Thumbs', emoji: '👍', diamondCost: 5, rcoinEarned: 0, isVipOnly: false, animation: 'float', giftType: 'emoji' },
    { id: 'fire', name: 'Fire', emoji: '🔥', diamondCost: 25, rcoinEarned: 2, isVipOnly: false, animation: 'float', giftType: 'emoji' },
    { id: 'star', name: 'Star', emoji: '⭐', diamondCost: 50, rcoinEarned: 5, isVipOnly: false, animation: 'sparkle', giftType: 'emoji' },
    { id: 'dragon', name: 'Dragon', emoji: '🐉', diamondCost: 5000, rcoinEarned: 500, isVipOnly: true, animation: 'epic', giftType: 'emoji' },
];
// Combined catalog for lookup — only emoji gifts in static config.
// SVGA gifts are created/managed via the admin panel and stored in MongoDB.
exports.ALL_GIFTS = [...exports.GIFT_CATALOG];
function getGiftById(giftId) {
    return exports.ALL_GIFTS.find((g) => g.id === giftId);
}
