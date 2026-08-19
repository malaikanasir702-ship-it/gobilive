"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFanClub = exports.togglePrivateAccount = exports.getPendingFollowRequests = exports.cancelFollowRequest = exports.rejectFollowRequest = exports.acceptFollowRequest = exports.getBlockedUsers = exports.unblockUser = exports.blockUser = exports.updateNotificationPrefs = exports.unfollowUser = exports.followUser = exports.getFollowing = exports.getFollowers = exports.getUserById = exports.changeUsername = exports.checkUsernameAvailability = exports.updateProfile = void 0;
const user_model_1 = require("./user.model");
const follow_model_1 = require("./follow.model");
const follow_request_model_1 = require("./follow-request.model");
const notification_service_1 = require("../notifications/notification.service");
const notification_model_1 = __importDefault(require("../notifications/notification.model"));
const updateProfile = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const { bio, profilePic, age, gender, thought, payoutMethod, payoutDetails, bankName, bankAccountNumber, bankAccountHolder } = req.body;
        const user = await user_model_1.User.findById(req.user.id);
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        if (bio !== undefined)
            user.bio = bio;
        if (profilePic !== undefined)
            user.profilePic = profilePic;
        if (age !== undefined)
            user.age = age;
        if (gender !== undefined)
            user.gender = gender;
        if (thought !== undefined) {
            user.thought = thought;
            user.thoughtUpdatedAt = new Date();
        }
        if (payoutMethod !== undefined)
            user.payoutMethod = payoutMethod;
        if (payoutDetails !== undefined)
            user.payoutDetails = payoutDetails;
        if (bankName !== undefined)
            user.bankName = bankName;
        if (bankAccountNumber !== undefined)
            user.bankAccountNumber = bankAccountNumber;
        if (bankAccountHolder !== undefined)
            user.bankAccountHolder = bankAccountHolder;
        await user.save();
        res.status(200).json({ success: true, user: await user_model_1.User.findById(user.id).select('-passwordHash') });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateProfile = updateProfile;
// ─── Check Username Availability ──────────────────────────────────────────────
const checkUsernameAvailability = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const { username } = req.query;
        if (!username || username.trim().length < 3) {
            res.status(400).json({ success: false, message: 'Username must be at least 3 characters.' });
            return;
        }
        const clean = username.trim().toLowerCase();
        // Only allow alphanumeric + underscores
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(clean)) {
            res.status(400).json({ success: false, available: false, message: 'Username can only contain letters, numbers and underscores (3–20 chars).' });
            return;
        }
        const existing = await user_model_1.User.findOne({ username: new RegExp(`^${clean}$`, 'i'), _id: { $ne: req.user.id } }).select('_id').lean();
        res.status(200).json({ success: true, available: !existing });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.checkUsernameAvailability = checkUsernameAvailability;
// ─── Change Username (60-day cooldown) ────────────────────────────────────────
const changeUsername = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const { username } = req.body;
        if (!username || username.trim().length < 3) {
            res.status(400).json({ success: false, message: 'Username must be at least 3 characters.' });
            return;
        }
        const clean = username.trim().toLowerCase();
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(clean)) {
            res.status(400).json({ success: false, message: 'Username can only contain letters, numbers and underscores (3–20 chars).' });
            return;
        }
        const user = await user_model_1.User.findById(req.user.id);
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        // 7-day cooldown check
        if (user.usernameChangedAt) {
            const daysSinceChange = (Date.now() - user.usernameChangedAt.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceChange < 7) {
                const daysRemaining = Math.ceil(7 - daysSinceChange);
                res.status(429).json({
                    success: false,
                    message: `You can change your username again in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`,
                    daysRemaining,
                });
                return;
            }
        }
        // Uniqueness check (case-insensitive, exclude self)
        const existing = await user_model_1.User.findOne({ username: new RegExp(`^${clean}$`, 'i'), _id: { $ne: req.user.id } }).select('_id').lean();
        if (existing) {
            res.status(409).json({ success: false, message: 'This username is already taken. Try a different one.' });
            return;
        }
        user.username = clean;
        user.usernameChangedAt = new Date();
        await user.save();
        res.status(200).json({ success: true, user: await user_model_1.User.findById(user.id).select('-passwordHash') });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.changeUsername = changeUsername;
const auth_controller_1 = require("./auth.controller");
const getUserById = async (req, res) => {
    try {
        const user = await (0, auth_controller_1.getSafeUser)(String(req.params.userId));
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        // If the viewer has blocked the target OR the target has blocked the viewer,
        // return a 403 so the profile is hidden.
        if (req.user) {
            const viewerId = req.user.id;
            const targetBlockedViewer = user.blockedUsers?.some((id) => String(id) === String(viewerId));
            const viewerBlockedTarget = await user_model_1.User.findById(viewerId)
                .select('blockedUsers')
                .lean();
            const viewerHasBlocked = viewerBlockedTarget?.blockedUsers?.some((id) => String(id) === String(user._id));
            if (targetBlockedViewer || viewerHasBlocked) {
                res.status(403).json({
                    success: false,
                    message: 'This profile is not available.',
                    isBlocked: true,
                });
                return;
            }
        }
        let isFollowing = false;
        let isBlockedByMe = false;
        let isFollowRequestPending = false;
        if (req.user) {
            const follow = await follow_model_1.Follow.findOne({
                followerId: req.user.id,
                followingId: user.id,
            });
            isFollowing = !!follow;
            const me = await user_model_1.User.findById(req.user.id).select('blockedUsers').lean();
            isBlockedByMe = me?.blockedUsers?.some((id) => String(id) === String(user._id)) ?? false;
            // Check if there is a pending follow request from viewer to target
            if (!isFollowing && user.isPrivate) {
                const existingReq = await follow_request_model_1.FollowRequest.findOne({
                    fromId: req.user.id,
                    toId: user._id,
                    status: 'pending',
                }).select('_id');
                isFollowRequestPending = !!existingReq;
            }
        }
        res.status(200).json({ success: true, user, isFollowing, isBlockedByMe, isFollowRequestPending });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getUserById = getUserById;
const getFollowers = async (req, res) => {
    try {
        const userId = String(req.params.userId);
        const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
        const skip = (page - 1) * limit;
        const total = await follow_model_1.Follow.countDocuments({ followingId: userId });
        const rows = await follow_model_1.Follow.find({ followingId: userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('followerId', 'username bio profilePic level isVIP vipFrame badges followersCount followingCount likesCount')
            .lean();
        const users = rows
            .map((r) => r.followerId)
            .filter(Boolean);
        res.status(200).json({ success: true, users, page, limit, total });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getFollowers = getFollowers;
const getFollowing = async (req, res) => {
    try {
        const userId = String(req.params.userId);
        const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
        const skip = (page - 1) * limit;
        const total = await follow_model_1.Follow.countDocuments({ followerId: userId });
        const rows = await follow_model_1.Follow.find({ followerId: userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('followingId', 'username bio profilePic level isVIP vipFrame badges followersCount followingCount likesCount thought thoughtUpdatedAt')
            .lean();
        const users = rows
            .map((r) => r.followingId)
            .filter(Boolean);
        res.status(200).json({ success: true, users, page, limit, total });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getFollowing = getFollowing;
const followUser = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const targetId = String(req.params.userId);
        if (targetId === req.user.id) {
            res.status(400).json({ success: false, message: 'Cannot follow yourself.' });
            return;
        }
        const target = await user_model_1.User.findById(targetId).select('username profilePic isPrivate followersCount notificationPrefs');
        if (!target) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        const existing = await follow_model_1.Follow.findOne({ followerId: req.user.id, followingId: targetId });
        if (existing) {
            res.status(400).json({ success: false, message: 'Already following.' });
            return;
        }
        const actor = await user_model_1.User.findById(req.user.id).select('username profilePic').lean();
        // ── Private account: send follow request instead of following directly ──
        if (target.isPrivate) {
            // Upsert: if a rejected request exists, re-open it as pending
            let followReqId;
            const existingReq = await follow_request_model_1.FollowRequest.findOne({ fromId: req.user.id, toId: targetId });
            if (existingReq) {
                if (existingReq.status === 'pending') {
                    res.status(400).json({ success: false, message: 'Follow request already sent.', requestSent: true });
                    return;
                }
                existingReq.status = 'pending';
                await existingReq.save();
                followReqId = String(existingReq._id);
            }
            else {
                const newReq = await follow_request_model_1.FollowRequest.create({ fromId: req.user.id, toId: targetId, status: 'pending' });
                followReqId = String(newReq._id);
            }
            // Notify target about the follow request
            // referenceId = FollowRequest._id so the app can call accept/reject with it
            if (target.notificationPrefs?.follows !== false) {
                (0, notification_service_1.createAndSend)({
                    recipientId: targetId,
                    actorId: req.user.id,
                    actorUsername: actor?.username ?? req.user.username,
                    actorProfilePic: actor?.profilePic ?? '',
                    type: 'follow_request',
                    payload: notification_service_1.NotificationTriggers.followRequest(actor?.username ?? req.user.username),
                    referenceId: followReqId, // ← FollowRequest _id (not actorId)
                }).catch(() => { });
            }
            res.status(200).json({ success: true, message: 'Follow request sent.', requestSent: true });
            return;
        }
        // ── Public account: follow directly ──
        await follow_model_1.Follow.create({ followerId: req.user.id, followingId: targetId });
        await user_model_1.User.findByIdAndUpdate(req.user.id, { $inc: { followingCount: 1 } });
        await user_model_1.User.findByIdAndUpdate(targetId, { $inc: { followersCount: 1 } });
        if (target.notificationPrefs?.follows !== false) {
            (0, notification_service_1.createAndSend)({
                recipientId: targetId,
                actorId: req.user.id,
                actorUsername: actor?.username ?? req.user.username,
                actorProfilePic: actor?.profilePic ?? '',
                type: 'follow',
                payload: notification_service_1.NotificationTriggers.newFollower(actor?.username ?? req.user.username),
                referenceId: req.user.id,
            }).catch(() => { });
        }
        res.status(200).json({ success: true, message: 'Followed successfully.' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.followUser = followUser;
const unfollowUser = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const targetId = String(req.params.userId);
        const removed = await follow_model_1.Follow.findOneAndDelete({
            followerId: req.user.id,
            followingId: targetId,
        });
        if (!removed) {
            res.status(400).json({ success: false, message: 'Not following this user.' });
            return;
        }
        await user_model_1.User.findByIdAndUpdate(req.user.id, { $inc: { followingCount: -1 } });
        await user_model_1.User.findByIdAndUpdate(targetId, { $inc: { followersCount: -1 } });
        res.status(200).json({ success: true, message: 'Unfollowed successfully.' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.unfollowUser = unfollowUser;
const updateNotificationPrefs = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const user = await user_model_1.User.findById(req.user.id);
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        user.notificationPrefs = { ...user.notificationPrefs, ...req.body };
        await user.save();
        res.status(200).json({ success: true, notificationPrefs: user.notificationPrefs });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateNotificationPrefs = updateNotificationPrefs;
const blockUser = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const { userId } = req.params;
        if (userId === req.user.id) {
            res.status(400).json({ success: false, message: 'Cannot block yourself.' });
            return;
        }
        await user_model_1.User.findByIdAndUpdate(req.user.id, { $addToSet: { blockedUsers: userId } });
        // Also remove any existing follow relationship in both directions
        await follow_model_1.Follow.findOneAndDelete({ followerId: req.user.id, followingId: userId });
        await follow_model_1.Follow.findOneAndDelete({ followerId: userId, followingId: req.user.id });
        // Decrement counts accordingly (best-effort, ignore if follow didn't exist)
        await user_model_1.User.findByIdAndUpdate(req.user.id, { $inc: { followingCount: -1 } }).catch(() => { });
        await user_model_1.User.findByIdAndUpdate(userId, { $inc: { followersCount: -1 } }).catch(() => { });
        await user_model_1.User.findByIdAndUpdate(userId, { $inc: { followingCount: -1 } }).catch(() => { });
        await user_model_1.User.findByIdAndUpdate(req.user.id, { $inc: { followersCount: -1 } }).catch(() => { });
        res.status(200).json({ success: true, message: 'User blocked.' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.blockUser = blockUser;
const unblockUser = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const { userId } = req.params;
        await user_model_1.User.findByIdAndUpdate(req.user.id, { $pull: { blockedUsers: userId } });
        res.status(200).json({ success: true, message: 'User unblocked.' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.unblockUser = unblockUser;
const getBlockedUsers = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const me = await user_model_1.User.findById(req.user.id).select('blockedUsers').lean();
        const blockedIds = me?.blockedUsers ?? [];
        if (blockedIds.length === 0) {
            res.status(200).json({ success: true, users: [] });
            return;
        }
        const users = await user_model_1.User.find({ _id: { $in: blockedIds } })
            .select('username profilePic bio isVIP')
            .lean();
        res.status(200).json({ success: true, users });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getBlockedUsers = getBlockedUsers;
// ─── Follow Request: Accept ───────────────────────────────────────────────
const acceptFollowRequest = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const { requestId } = req.params;
        const request = await follow_request_model_1.FollowRequest.findById(requestId);
        if (!request) {
            res.status(404).json({ success: false, message: 'Request not found.' });
            return;
        }
        if (String(request.toId) !== req.user.id) {
            res.status(403).json({ success: false, message: 'Not your request.' });
            return;
        }
        if (request.status !== 'pending') {
            res.status(400).json({ success: false, message: 'Request is no longer pending.' });
            return;
        }
        // Create the actual follow
        const fromId = String(request.fromId);
        const toId = String(request.toId);
        const alreadyFollowing = await follow_model_1.Follow.findOne({ followerId: fromId, followingId: toId });
        if (!alreadyFollowing) {
            await follow_model_1.Follow.create({ followerId: fromId, followingId: toId });
            await user_model_1.User.findByIdAndUpdate(fromId, { $inc: { followingCount: 1 } });
            await user_model_1.User.findByIdAndUpdate(toId, { $inc: { followersCount: 1 } });
        }
        request.status = 'accepted';
        await request.save();
        // Update the original follow_request notification → mark it acted upon
        // so when the notification page refreshes it shows "accepted" not the buttons.
        await notification_model_1.default.findOneAndUpdate({
            recipientId: toId,
            type: 'follow_request',
            referenceId: String(request._id),
        }, {
            $set: {
                type: 'follow_request',
                referenceId: `__accepted__${String(request._id)}`,
                isRead: true,
            },
        });
        // Notify the requester that their request was accepted
        const acceptor = await user_model_1.User.findById(toId).select('username profilePic').lean();
        (0, notification_service_1.createAndSend)({
            recipientId: fromId,
            actorId: toId,
            actorUsername: acceptor?.username ?? '',
            actorProfilePic: acceptor?.profilePic ?? '',
            type: 'follow_request_accepted',
            payload: notification_service_1.NotificationTriggers.followRequestAccepted(acceptor?.username ?? ''),
            referenceId: toId,
        }).catch(() => { });
        res.status(200).json({ success: true, message: 'Follow request accepted.' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.acceptFollowRequest = acceptFollowRequest;
// ─── Follow Request: Reject ───────────────────────────────────────────────
const rejectFollowRequest = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const { requestId } = req.params;
        const request = await follow_request_model_1.FollowRequest.findById(requestId);
        if (!request) {
            res.status(404).json({ success: false, message: 'Request not found.' });
            return;
        }
        if (String(request.toId) !== req.user.id) {
            res.status(403).json({ success: false, message: 'Not your request.' });
            return;
        }
        request.status = 'rejected';
        await request.save();
        // Update the original follow_request notification → mark it declined
        await notification_model_1.default.findOneAndUpdate({
            recipientId: String(request.toId),
            type: 'follow_request',
            referenceId: String(request._id),
        }, {
            $set: {
                referenceId: `__declined__${String(request._id)}`,
                isRead: true,
            },
        });
        res.status(200).json({ success: true, message: 'Follow request declined.' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.rejectFollowRequest = rejectFollowRequest;
// ─── Follow Request: Cancel (by the sender) ───────────────────────────────
const cancelFollowRequest = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const targetId = req.params.userId;
        await follow_request_model_1.FollowRequest.findOneAndDelete({ fromId: req.user.id, toId: targetId, status: 'pending' });
        res.status(200).json({ success: true, message: 'Follow request cancelled.' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.cancelFollowRequest = cancelFollowRequest;
// ─── Get Pending Follow Requests (for the private account owner) ──────────
const getPendingFollowRequests = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const requests = await follow_request_model_1.FollowRequest.find({ toId: req.user.id, status: 'pending' })
            .sort({ createdAt: -1 })
            .limit(50)
            .populate('fromId', 'username profilePic bio isVIP')
            .lean();
        const mapped = requests.map((r) => ({
            requestId: String(r._id),
            user: r.fromId,
            createdAt: r.createdAt,
        }));
        res.status(200).json({ success: true, requests: mapped });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getPendingFollowRequests = getPendingFollowRequests;
// ─── Toggle Private Account ────────────────────────────────────────────────
const togglePrivateAccount = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const user = await user_model_1.User.findById(req.user.id);
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        user.isPrivate = !user.isPrivate;
        await user.save();
        // If switching to public: auto-accept all pending requests
        if (!user.isPrivate) {
            const pendingRequests = await follow_request_model_1.FollowRequest.find({ toId: req.user.id, status: 'pending' });
            for (const req_ of pendingRequests) {
                const fromId = String(req_.fromId);
                const toId = String(req_.toId);
                const alreadyFollowing = await follow_model_1.Follow.findOne({ followerId: fromId, followingId: toId });
                if (!alreadyFollowing) {
                    await follow_model_1.Follow.create({ followerId: fromId, followingId: toId });
                    await user_model_1.User.findByIdAndUpdate(fromId, { $inc: { followingCount: 1 } });
                    await user_model_1.User.findByIdAndUpdate(toId, { $inc: { followersCount: 1 } });
                }
                req_.status = 'accepted';
                await req_.save();
            }
        }
        const safeUser = await user_model_1.User.findById(req.user.id).select('-passwordHash');
        res.status(200).json({
            success: true,
            isPrivate: user.isPrivate,
            message: user.isPrivate ? 'Account set to private.' : 'Account set to public.',
            user: safeUser,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.togglePrivateAccount = togglePrivateAccount;
// ─── Fan Club ──────────────────────────────────────────────────────────────
const getFanClub = async (req, res) => {
    try {
        const { userId } = req.params;
        const targetUser = await user_model_1.User.findById(userId)
            .select('followersCount likesCount')
            .lean();
        if (!targetUser) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        // Top 10 followers sorted by their own likesCount
        const followRows = await follow_model_1.Follow.find({ followingId: userId })
            .populate('followerId', 'username profilePic likesCount')
            .lean();
        const topFans = followRows
            .map((r) => r.followerId)
            .filter(Boolean)
            .sort((a, b) => (b.likesCount ?? 0) - (a.likesCount ?? 0))
            .slice(0, 10)
            .map((u) => ({
            userId: String(u._id),
            username: u.username,
            profilePic: u.profilePic ?? '',
            likesCount: u.likesCount ?? 0,
        }));
        const clubLevel = Math.max(1, Math.floor((targetUser.followersCount ?? 0) / 100) + 1);
        res.status(200).json({
            success: true,
            fanClub: {
                membersCount: targetUser.followersCount ?? 0,
                totalLikes: targetUser.likesCount ?? 0,
                clubLevel,
                topFans,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getFanClub = getFanClub;
