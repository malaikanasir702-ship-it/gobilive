"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startCronJobs = startCronJobs;
const node_cron_1 = __importDefault(require("node-cron"));
const user_model_1 = require("../../features/auth/user.model");
const activity_log_service_1 = require("../../features/activity-log/activity-log.service");
const logger_middleware_1 = __importDefault(require("../middlewares/logger.middleware"));
/**
 * ── CRON JOB 1: Auto-unblock temporarily banned users ───────────────────────
 * Runs every hour at minute 0.
 * Finds users where isBlocked=true, blockType='temporary', blockedUntil <= now.
 * Unblocks them and logs the activity.
 */
async function unblockExpiredBans() {
    try {
        const now = new Date();
        const expiredBans = await user_model_1.User.find({
            isBlocked: true,
            blockType: 'temporary',
            blockedUntil: { $lte: now },
        }).select('_id username role').lean();
        if (expiredBans.length === 0)
            return;
        const ids = expiredBans.map((u) => u._id);
        await user_model_1.User.updateMany({ _id: { $in: ids } }, {
            $set: { isBlocked: false },
            $unset: { blockedUntil: '', blockType: '' },
        });
        // Log each unblock in activity log
        for (const u of expiredBans) {
            await (0, activity_log_service_1.logActivity)({
                actorId: 'system',
                actorRole: 'company_admin',
                actionType: 'auto_unblock',
                targetEntityType: 'User',
                targetEntityId: u._id.toString(),
                description: `[CRON] Auto-unblocked ${u.username} (${u.role}) — temporary ban expired.`,
            });
        }
        logger_middleware_1.default.info(`[CRON] Auto-unblocked ${expiredBans.length} user(s) with expired temporary bans.`);
    }
    catch (err) {
        logger_middleware_1.default.error(`[CRON] unblockExpiredBans error: ${err.message}`);
    }
}
/**
 * ── CRON JOB 2: Revoke expired VIP memberships ──────────────────────────────
 * Runs every day at midnight (00:00).
 * Finds users where isVIP=true, vipExpiresAt <= now.
 * Revokes VIP status and clears the VIP frame.
 */
async function revokeExpiredVIP() {
    try {
        const now = new Date();
        const expiredVIPs = await user_model_1.User.find({
            isVIP: true,
            vipExpiresAt: { $lte: now },
        }).select('_id username role').lean();
        if (expiredVIPs.length === 0)
            return;
        const ids = expiredVIPs.map((u) => u._id);
        await user_model_1.User.updateMany({ _id: { $in: ids } }, {
            $set: { isVIP: false, vipFrame: '' },
            $unset: { vipExpiresAt: '' },
        });
        for (const u of expiredVIPs) {
            await (0, activity_log_service_1.logActivity)({
                actorId: 'system',
                actorRole: 'company_admin',
                actionType: 'auto_revoke_vip',
                targetEntityType: 'User',
                targetEntityId: u._id.toString(),
                description: `[CRON] Auto-revoked VIP for ${u.username} (${u.role}) — VIP subscription expired.`,
            });
        }
        logger_middleware_1.default.info(`[CRON] Revoked VIP for ${expiredVIPs.length} user(s).`);
    }
    catch (err) {
        logger_middleware_1.default.error(`[CRON] revokeExpiredVIP error: ${err.message}`);
    }
}
/**
 * Initialize and start all cron jobs.
 * Call this once after the database connection is established.
 */
function startCronJobs() {
    // Every hour at minute 0
    node_cron_1.default.schedule('0 * * * *', unblockExpiredBans, {
        name: 'unblock-expired-bans',
        timezone: 'UTC',
    });
    // Every day at midnight UTC
    node_cron_1.default.schedule('0 0 * * *', revokeExpiredVIP, {
        name: 'revoke-expired-vip',
        timezone: 'UTC',
    });
    logger_middleware_1.default.info('[CRON] Scheduler started: unblock-expired-bans (hourly), revoke-expired-vip (daily).');
}
