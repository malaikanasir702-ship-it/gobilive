"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BADGE_CATALOG = exports.VIP_PLANS = exports.DIAMOND_PACKAGES = exports.MIN_CONVERT_DIAMONDS = exports.MIN_WITHDRAW_RCOINS = exports.DIAMOND_TO_RCOIN_RATE = void 0;
exports.DIAMOND_TO_RCOIN_RATE = 10; // 10 diamonds = 1 rcoin
exports.MIN_WITHDRAW_RCOINS = 100;
exports.MIN_CONVERT_DIAMONDS = 10;
exports.DIAMOND_PACKAGES = [
    { id: 'pack_500', label: 'Starter', diamonds: 500, priceUsdCents: 499, bonusDiamonds: 0 },
    { id: 'pack_1200', label: 'Popular', diamonds: 1200, priceUsdCents: 999, bonusDiamonds: 100 },
    { id: 'pack_3000', label: 'Pro', diamonds: 3000, priceUsdCents: 1999, bonusDiamonds: 300 },
    { id: 'pack_8000', label: 'Whale', diamonds: 8000, priceUsdCents: 4999, bonusDiamonds: 1000 },
];
exports.VIP_PLANS = [
    {
        id: 'vip_monthly',
        name: 'VIP Monthly',
        priceUsdCents: 999,
        diamondPrice: 1500,
        durationDays: 30,
        vipFrame: 'gold_crown',
        badge: 'vip_star',
        perks: ['Gold profile frame', 'VIP badge in chat', 'Priority support'],
    },
    {
        id: 'vip_yearly',
        name: 'VIP Yearly',
        priceUsdCents: 7999,
        diamondPrice: 10000,
        durationDays: 365,
        vipFrame: 'platinum_aura',
        badge: 'vip_elite',
        perks: ['Platinum frame', 'Elite badge', 'Exclusive gifts', '20% bonus diamonds'],
    },
];
exports.BADGE_CATALOG = {
    vip_star: { label: 'VIP', color: '#FFD700' },
    vip_elite: { label: 'ELITE', color: '#E5E4E2' },
    top_gifter: { label: 'GIFTER', color: '#B54FE4' },
    streamer: { label: 'LIVE', color: '#DC3C66' },
    founder: { label: 'FOUNDER', color: '#4D0FA8' },
};
