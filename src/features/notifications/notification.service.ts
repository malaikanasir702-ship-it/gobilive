import { getMessaging, isFirebaseConfigured, initFirebase } from '../../config/firebase';
import { User } from '../auth/user.model';
import Notification, { NotificationType } from './notification.model';

export type NotificationPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

export async function registerFcmToken(userId: string, token: string, platform?: string) {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const tokens = new Set(user.fcmTokens ?? []);
  tokens.add(token);
  user.fcmTokens = Array.from(tokens);
  if (platform) {
    user.fcmPlatform = platform;
  }
  await user.save();
  return { registered: true, tokenCount: user.fcmTokens.length };
}

export async function removeFcmToken(userId: string, token: string) {
  await User.findByIdAndUpdate(userId, {
    $pull: { fcmTokens: token },
  });
}

export async function sendToUser(userId: string, payload: NotificationPayload) {
  const user = await User.findById(userId).select('fcmTokens username');
  if (!user || !user.fcmTokens?.length) {
    return { sent: 0, skipped: 'no_tokens' };
  }
  return sendToTokens(user.fcmTokens, payload, userId);
}

export async function sendToTokens(
  tokens: string[],
  payload: NotificationPayload,
  userIdForCleanup?: string
) {
  if (!isFirebaseConfigured()) {
    initFirebase();
  }

  const messaging = getMessaging();
  if (!messaging) {
    console.log(`📱 [FCM mock] → ${tokens.length} device(s): ${payload.title} — ${payload.body}`);
    return { sent: 0, mock: true };
  }

  const message = {
    notification: { title: payload.title, body: payload.body },
    data: payload.data ?? {},
    tokens,
    android: { priority: 'high' as const },
    apns: { payload: { aps: { sound: 'default' } } },
  };

  const response = await messaging.sendEachForMulticast(message);

  if (userIdForCleanup && response.failureCount > 0) {
    const invalidTokens: string[] = [];
    response.responses.forEach((res, i) => {
      if (!res.success && res.error?.code === 'messaging/registration-token-not-registered') {
        invalidTokens.push(tokens[i]);
      }
    });
    if (invalidTokens.length) {
      await User.findByIdAndUpdate(userIdForCleanup, { $pull: { fcmTokens: { $in: invalidTokens } } });
    }
  }

  return { sent: response.successCount, failed: response.failureCount };
}

export const NotificationTriggers = {
  walletTopUp: (diamonds: number): NotificationPayload => ({
    title: 'Diamonds Received! 💎',
    body: `${diamonds} diamonds were added to your wallet.`,
    data: { type: 'wallet_topup', diamonds: String(diamonds) },
  }),
  vipActivated: (planName: string): NotificationPayload => ({
    title: 'VIP Activated! ⭐',
    body: `Welcome to ${planName}. Enjoy your exclusive perks!`,
    data: { type: 'vip_activated' },
  }),
  withdrawalSubmitted: (amount: number): NotificationPayload => ({
    title: 'Withdrawal Submitted',
    body: `Your withdrawal of ${amount} Beans is being processed.`,
    data: { type: 'withdrawal' },
  }),
  liveGift: (sender: string, giftName: string): NotificationPayload => ({
    title: 'Gift Received! 🎁',
    body: `@${sender} sent you ${giftName}`,
    data: { type: 'live_gift' },
  }),
  pkStarted: (opponent: string): NotificationPayload => ({
    title: 'PK Battle Started! ⚔️',
    body: `You are now battling @${opponent}`,
    data: { type: 'pk_started' },
  }),
  newMessage: (sender: string, preview: string): NotificationPayload => ({
    title: `Message from @${sender}`,
    body: preview.slice(0, 120),
    data: { type: 'chat_message' },
  }),
  newFollower: (username: string): NotificationPayload => ({
    title: 'New Follower',
    body: `@${username} started following you`,
    data: { type: 'follow' },
  }),
  missedCall: (caller: string): NotificationPayload => ({
    title: 'Missed Video Call',
    body: `@${caller} tried to call you`,
    data: { type: 'missed_call' },
  }),
  // ── Feed interaction triggers ──
  postLiked: (liker: string): NotificationPayload => ({
    title: 'New Like',
    body: `@${liker} liked your video`,
    data: { type: 'post_like' },
  }),
  postCommented: (commenter: string, preview: string): NotificationPayload => ({
    title: 'New Comment',
    body: `@${commenter}: ${preview.slice(0, 80)}`,
    data: { type: 'post_comment' },
  }),
  postSaved: (saver: string): NotificationPayload => ({
    title: 'Video Saved',
    body: `@${saver} saved your video`,
    data: { type: 'post_save' },
  }),
};

// ─────────────────────────────────────────────
// Convenience: persist to DB + fire FCM in one call
// ─────────────────────────────────────────────

/**
 * Saves the notification to MongoDB (for the notification page history)
 * and fires the FCM push (for the lock-screen / status-bar banner).
 *
 * Non-throwing — logs errors so feed actions never fail because of a
 * notification issue.
 */
export async function createAndSend(opts: {
  recipientId: string;
  actorId?: string;
  actorUsername?: string;
  actorProfilePic?: string;
  type: NotificationType;
  payload: NotificationPayload;
  referenceId?: string;
}): Promise<void> {
  try {
    // 1. Persist to DB
    await Notification.create({
      recipientId: opts.recipientId,
      actorId: opts.actorId,
      actorUsername: opts.actorUsername ?? '',
      actorProfilePic: opts.actorProfilePic ?? '',
      type: opts.type,
      title: opts.payload.title,
      body: opts.payload.body,
      referenceId: opts.referenceId,
      isRead: false,
    });

    // 2. Fire FCM push
    await sendToUser(opts.recipientId, opts.payload);
  } catch (err) {
    console.error('[Notification] createAndSend error:', (err as Error).message);
  }
}
