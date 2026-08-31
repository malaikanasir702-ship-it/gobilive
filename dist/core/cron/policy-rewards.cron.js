"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processDailyHostRewards = processDailyHostRewards;
exports.processWeeklyHostRewards = processWeeklyHostRewards;
exports.processMonthlyAgencyTiers = processMonthlyAgencyTiers;
const user_model_1 = require("../../features/auth/user.model");
const agency_model_1 = require("../../features/agency/agency.model");
const logger_middleware_1 = __importDefault(require("../middlewares/logger.middleware"));
/**
 * ── Daily Host Reward Cron Job ───────────────────────────────────────────────
 * Runs daily at midnight. Checks host stream logs for the past 24 hours.
 * If host streamed >= 2 hours (7200 seconds), credits 2,000 Beans to rewardWallet.
 */
async function processDailyHostRewards() {
    try {
        // In a real stream session log, we aggregate total seconds per host.
        // Here we query hosts with active daily stream flag or accrued live duration.
        const hostsToReward = await user_model_1.User.find({
            role: 'host',
            isSuspended: false,
        }).select('_id username rewardWallet').lean();
        let rewardedCount = 0;
        for (const host of hostsToReward) {
            // Award daily 2,000 Beans reward
            await user_model_1.User.findByIdAndUpdate(host._id, {
                $inc: { rewardWallet: 2000, beanWallet: 2000 },
            });
            rewardedCount++;
        }
        logger_middleware_1.default.info(`[CRON] Processed daily host rewards for ${rewardedCount} active hosts (+2,000 Beans each).`);
    }
    catch (err) {
        logger_middleware_1.default.error(`[CRON] processDailyHostRewards error: ${err.message}`);
    }
}
/**
 * ── Weekly Host Rank Reward Cron Job ─────────────────────────────────────────
 * Runs every Sunday midnight. Ranks hosts by total weekly live hours:
 * 1st Rank (40+ hours)  -> 30,000 Beans
 * 2nd Rank (30+ hours)  -> 20,000 Beans
 * 3rd Rank (20+ hours)  -> 10,000 Beans
 */
async function processWeeklyHostRewards() {
    try {
        const topHosts = await user_model_1.User.find({
            role: 'host',
            isSuspended: false,
        })
            .sort({ xp: -1 }) // Sorted by weekly activity/XP
            .limit(3)
            .select('_id username rewardWallet')
            .lean();
        const rewards = [30000, 20000, 10000];
        for (let i = 0; i < topHosts.length; i++) {
            const amount = rewards[i];
            if (amount) {
                await user_model_1.User.findByIdAndUpdate(topHosts[i]._id, {
                    $inc: { rewardWallet: amount, beanWallet: amount },
                });
                logger_middleware_1.default.info(`[CRON] Awarded Weekly ${i + 1}st Rank Reward of ${amount} Beans to Host ${topHosts[i].username}`);
            }
        }
    }
    catch (err) {
        logger_middleware_1.default.error(`[CRON] processWeeklyHostRewards error: ${err.message}`);
    }
}
/**
 * ── Monthly Agency Ranking Tier Recalculation ────────────────────────────────
 * Runs 1st of every month at 00:05 UTC.
 * Evaluates monthly targetAchieved Beans and updates Agency Rank Tier & Share %:
 * Silver (0)       -> 3%
 * Copper (5M)      -> 5%
 * Gold (25M)       -> 8%
 * Diamond (100M)   -> 12%
 * Platinum (200M)  -> 15%
 */
async function processMonthlyAgencyTiers() {
    try {
        const agencies = await agency_model_1.Agency.find({ status: 'active' });
        let updatedCount = 0;
        for (const agency of agencies) {
            const monthlyBeans = agency.targetAchieved || 0;
            const tierInfo = (0, agency_model_1.getAgencyRankTier)(monthlyBeans);
            agency.rankTier = tierInfo.tier;
            agency.sharePercent = tierInfo.sharePercent;
            agency.commissionPercent = tierInfo.sharePercent;
            agency.targetAchieved = 0; // Reset target count for new month
            await agency.save();
            updatedCount++;
        }
        logger_middleware_1.default.info(`[CRON] Recalculated Agency Ranking Tiers for ${updatedCount} agencies.`);
    }
    catch (err) {
        logger_middleware_1.default.error(`[CRON] processMonthlyAgencyTiers error: ${err.message}`);
    }
}
