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
    // Use $inc to atomically increment xp without triggering full-document schema validation
    const user = await user_model_1.User.findById(userId).select('xp level').lean();
    if (!user)
        throw new Error('User not found');
    const newXp = (user.xp ?? 0) + amount;
    const newLevel = levelFromXp(newXp);
    await user_model_1.User.updateOne({ _id: userId }, { $set: { xp: newXp, level: newLevel } });
    return { level: newLevel, xp: newXp };
}
async function addXpFromDiamondSpend(userId, diamonds) {
    return addXp(userId, diamonds * XP_PER_DIAMOND_SPENT);
}
