import cron from 'node-cron';
import { User } from '../../features/auth/user.model';
import { logActivity } from '../../features/activity-log/activity-log.service';
import logger from '../middlewares/logger.middleware';

/**
 * ── CRON JOB 1: Auto-unblock temporarily banned users ───────────────────────
 * Runs every hour at minute 0.
 * Finds users where isBlocked=true, blockType='temporary', blockedUntil <= now.
 * Unblocks them and logs the activity.
 */
async function unblockExpiredBans() {
  try {
    const now = new Date();
    const expiredBans = await User.find({
      isBlocked: true,
      blockType: 'temporary',
      blockedUntil: { $lte: now },
    }).select('_id username role').lean();

    if (expiredBans.length === 0) return;

    const ids = expiredBans.map((u: any) => u._id);
    await User.updateMany(
      { _id: { $in: ids } },
      {
        $set: { isBlocked: false },
        $unset: { blockedUntil: '', blockType: '' },
      }
    );

    // Log each unblock in activity log
    for (const u of expiredBans) {
      await logActivity({
        actorId: 'system',
        actorRole: 'company_admin',
        actionType: 'auto_unblock',
        targetEntityType: 'User',
        targetEntityId: (u._id as any).toString(),
        description: `[CRON] Auto-unblocked ${u.username} (${u.role}) — temporary ban expired.`,
      });
    }

    logger.info(`[CRON] Auto-unblocked ${expiredBans.length} user(s) with expired temporary bans.`);
  } catch (err: any) {
    logger.error(`[CRON] unblockExpiredBans error: ${err.message}`);
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
    const expiredVIPs = await User.find({
      isVIP: true,
      vipExpiresAt: { $lte: now },
    }).select('_id username role').lean();

    if (expiredVIPs.length === 0) return;

    const ids = expiredVIPs.map((u: any) => u._id);
    await User.updateMany(
      { _id: { $in: ids } },
      {
        $set: { isVIP: false, vipFrame: '' },
        $unset: { vipExpiresAt: '' },
      }
    );

    for (const u of expiredVIPs) {
      await logActivity({
        actorId: 'system',
        actorRole: 'company_admin',
        actionType: 'auto_revoke_vip',
        targetEntityType: 'User',
        targetEntityId: (u._id as any).toString(),
        description: `[CRON] Auto-revoked VIP for ${u.username} (${u.role}) — VIP subscription expired.`,
      });
    }

    logger.info(`[CRON] Revoked VIP for ${expiredVIPs.length} user(s).`);
  } catch (err: any) {
    logger.error(`[CRON] revokeExpiredVIP error: ${err.message}`);
  }
}

/**
 * Initialize and start all cron jobs.
 * Call this once after the database connection is established.
 */
export function startCronJobs(): void {
  // Every hour at minute 0
  cron.schedule('0 * * * *', unblockExpiredBans, {
    name: 'unblock-expired-bans',
    timezone: 'UTC',
  });

  // Every day at midnight UTC
  cron.schedule('0 0 * * *', revokeExpiredVIP, {
    name: 'revoke-expired-vip',
    timezone: 'UTC',
  });

  logger.info('[CRON] Scheduler started: unblock-expired-bans (hourly), revoke-expired-vip (daily).');
}
