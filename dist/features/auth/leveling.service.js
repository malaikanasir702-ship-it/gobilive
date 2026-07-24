"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.levelFromXp = levelFromXp;
exports.addXp = addXp;
exports.addXpFromDiamondSpend = addXpFromDiamondSpend;
const user_model_1 = require("./user.model");
const XP_PER_DIAMOND_SPENT = 1;
const XP_PER_LEVEL = 500;
function levelFromXp(xp) {
    return Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1);
}
async function addXp(userId, amount) {
    const user = await user_model_1.User.findById(userId);
    if (!user)
        throw new Error('User not found');
    user.xp = (user.xp ?? 0) + amount;
    user.level = levelFromXp(user.xp);
    await user.save();
    return { level: user.level, xp: user.xp };
}
async function addXpFromDiamondSpend(userId, diamonds) {
    return addXp(userId, diamonds * XP_PER_DIAMOND_SPENT);
}
