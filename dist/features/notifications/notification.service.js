"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationTriggers = void 0;
exports.registerFcmToken = registerFcmToken;
exports.removeFcmToken = removeFcmToken;
exports.sendToUser = sendToUser;
exports.sendToTokens = sendToTokens;
exports.createAndSend = createAndSend;
const firebase_1 = require("../../config/firebase");
const user_model_1 = require("../auth/user.model");
const notification_model_1 = __importDefault(require("./notification.model"));
async function registerFcmToken(userId, token, platform) {
    const user = await user_model_1.User.findById(userId);
    if (!user)
        throw new Error('User not found');
    const tokens = new Set(user.fcmTokens ?? []);
    tokens.add(token);
    user.fcmTokens = Array.from(tokens);
    if (platform) {
        user.fcmPlatform = platform;
    }
    await user.save();
    return { registered: true, tokenCount: user.fcmTokens.length };
}
async function removeFcmToken(userId, token) {
    await user_model_1.User.findByIdAndUpdate(userId, {
        $pull: { fcmTokens: token },
    });
}
async function sendToUser(userId, payload) {
    const user = await user_model_1.User.findById(userId).select('fcmTokens username');
    if (!user || !user.fcmTokens?.length) {
        return { sent: 0, skipped: 'no_tokens' };
    }
    return sendToTokens(user.fcmTokens, payload, userId);
}
async function sendToTokens(tokens, payload, userIdForCleanup) {
    if (!(0, firebase_1.isFirebaseConfigured)()) {
        (0, firebase_1.initFirebase)();
    }
    const messaging = (0, firebase_1.getMessaging)();
    if (!messaging) {
        console.log(`📱 [FCM mock] → ${tokens.length} device(s): ${payload.title} — ${payload.body}`);
        return { sent: 0, mock: true };
    }
    const message = {
        notification: { title: payload.title, body: payload.body },
        data: payload.data ?? {},
        tokens,
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
    };
    const response = await messaging.sendEachForMulticast(message);
    if (userIdForCleanup && response.failureCount > 0) {
        const invalidTokens = [];
        response.responses.forEach((res, i) => {
            if (!res.success && res.error?.code === 'messaging/registration-token-not-registered') {
                invalidTokens.push(tokens[i]);
            }
        });
        if (invalidTokens.length) {
            await user_model_1.User.findByIdAndUpdate(userIdForCleanup, { $pull: { fcmTokens: { $in: invalidTokens } } });
        }
    }
    return { sent: response.successCount, failed: response.failureCount };
}
exports.NotificationTriggers = {
    walletTopUp: (diamonds) => ({
        title: 'Diamonds Received! 💎',
        body: `${diamonds} diamonds were added to your wallet.`,
        data: { type: 'wallet_topup', diamonds: String(diamonds) },
    }),
    vipActivated: (planName) => ({
        title: 'VIP Activated! ⭐',
        body: `Welcome to ${planName}. Enjoy your exclusive perks!`,
        data: { type: 'vip_activated' },
    }),
    withdrawalSubmitted: (amount) => ({
        title: 'Withdrawal Submitted',
        body: `Your withdrawal of ${amount} Beans is being processed.`,
        data: { type: 'withdrawal' },
    }),
    liveGift: (sender, giftName) => ({
        title: 'Gift Received! 🎁',
        body: `@${sender} sent you ${giftName}`,
        data: { type: 'live_gift' },
    }),
    pkStarted: (opponent) => ({
        title: 'PK Battle Started! ⚔️',
        body: `You are now battling @${opponent}`,
        data: { type: 'pk_started' },
    }),
    newMessage: (sender, preview) => ({
        title: `Message from @${sender}`,
        body: preview.slice(0, 120),
        data: { type: 'chat_message' },
    }),
    newFollower: (username) => ({
        title: 'New Follower',
        body: `@${username} started following you`,
        data: { type: 'follow' },
    }),
    followRequest: (username) => ({
        title: 'New Follow Request',
        body: `@${username} wants to follow you`,
        data: { type: 'follow_request' },
    }),
    followRequestAccepted: (username) => ({
        title: 'Follow Request Accepted',
        body: `@${username} accepted your follow request`,
        data: { type: 'follow_request_accepted' },
    }),
    missedCall: (caller) => ({
        title: 'Missed Video Call',
        body: `@${caller} tried to call you`,
        data: { type: 'missed_call' },
    }),
    // ── Feed interaction triggers ──
    postLiked: (liker) => ({
        title: 'New Like',
        body: `@${liker} liked your video`,
        data: { type: 'post_like' },
    }),
    postCommented: (commenter, preview) => ({
        title: 'New Comment',
        body: `@${commenter}: ${preview.slice(0, 80)}`,
        data: { type: 'post_comment' },
    }),
    postSaved: (saver) => ({
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
async function createAndSend(opts) {
    try {
        // 1. Persist to DB
        await notification_model_1.default.create({
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
    }
    catch (err) {
        console.error('[Notification] createAndSend error:', err.message);
    }
}
