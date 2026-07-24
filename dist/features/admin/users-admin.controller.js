"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.suspendUser = exports.unblockUser = exports.blockUser = exports.getUserProfile = exports.listUsers = void 0;
const user_model_1 = require("../auth/user.model");
const wallet_transaction_model_1 = __importDefault(require("../wallet/wallet.transaction.model"));
const post_model_1 = require("../feed/post.model");
const live_model_1 = __importDefault(require("../live/live.model"));
const activity_log_service_1 = require("../activity-log/activity-log.service");
const BLOCK_DURATIONS_HOURS = {
    '2h': 2,
    '3h': 3,
    '5h': 5,
    '1d': 24,
};
// ─── List Users ───────────────────────────────────────────────────────────────
const listUsers = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
        const search = req.query.search || '';
        const status = req.query.status;
        const dateFrom = req.query.dateFrom;
        const dateTo = req.query.dateTo;
        const filter = {
            role: { $in: ['user'] },
        };
        if (search) {
            const re = new RegExp(search, 'i');
            filter.$or = [{ username: re }, { email: re }, { phone: re }];
        }
        if (status === 'active')
            filter.isSuspended = false;
        if (status === 'suspended')
            filter.isSuspended = true;
        if (status === 'blocked')
            filter.isBlocked = true;
        if (dateFrom || dateTo) {
            filter.createdAt = {};
            if (dateFrom)
                filter.createdAt.$gte = new Date(dateFrom);
            if (dateTo)
                filter.createdAt.$lte = new Date(dateTo);
        }
        const total = await user_model_1.User.countDocuments(filter);
        const users = await user_model_1.User.find(filter)
            .select('username email phone diamonds rcoins isSuspended isBlocked blockedUntil blockType createdAt profilePic role')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
        res.status(200).json({
            success: true,
            users,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.listUsers = listUsers;
// ─── Get Full User Profile ────────────────────────────────────────────────────
const getUserProfile = async (req, res) => {
    try {
        const id = String(req.params.id);
        const user = await user_model_1.User.findById(id)
            .select('-passwordHash -fcmTokens -twoFactorSecret -twoFactorPendingSecret')
            .lean();
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        const [beanTxs, posts, liveRooms] = await Promise.all([
            wallet_transaction_model_1.default.find({ userId: id, currency: 'rcoins' })
                .sort({ createdAt: -1 })
                .limit(50)
                .lean(),
            post_model_1.Post.find({ userId: id }).sort({ createdAt: -1 }).limit(20).lean(),
            live_model_1.default.find({ hostId: id }).sort({ createdAt: -1 }).limit(10).lean(),
        ]);
        res.status(200).json({
            success: true,
            user,
            beanTransactions: beanTxs,
            posts,
            liveHistory: liveRooms,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getUserProfile = getUserProfile;
// ─── Block User ───────────────────────────────────────────────────────────────
const blockUser = async (req, res) => {
    try {
        const id = String(req.params.id);
        const { type, duration } = req.body; // type: 'permanent' | 'temporary', duration: '2h'|'3h'|'5h'|'1d'
        if (!type || !['permanent', 'temporary'].includes(type)) {
            res.status(400).json({ success: false, message: 'Block type must be permanent or temporary.' });
            return;
        }
        if (type === 'temporary' && !BLOCK_DURATIONS_HOURS[duration]) {
            res.status(400).json({ success: false, message: 'Duration must be 2h, 3h, 5h, or 1d.' });
            return;
        }
        const update = { isBlocked: true, blockType: type };
        if (type === 'temporary') {
            const hours = BLOCK_DURATIONS_HOURS[duration];
            update.blockedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
        }
        else {
            update.$unset = { blockedUntil: 1 };
        }
        const user = await user_model_1.User.findByIdAndUpdate(id, update, { new: true }).select('username isBlocked blockType blockedUntil');
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        await (0, activity_log_service_1.logActivity)({
            actorId: req.adminUser.id,
            actorRole: req.adminUser.role,
            actionType: 'block_user',
            targetEntityType: 'User',
            targetEntityId: id,
            description: `Blocked user ${user.username} (${type}${type === 'temporary' ? `, ${duration}` : ''})`,
        });
        // End any active streams if permanently blocked
        if (type === 'permanent') {
            await live_model_1.default.updateMany({ hostId: id, isActive: true }, { isActive: false });
        }
        res.status(200).json({ success: true, user });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.blockUser = blockUser;
// ─── Unblock User ─────────────────────────────────────────────────────────────
const unblockUser = async (req, res) => {
    try {
        const id = String(req.params.id);
        const user = await user_model_1.User.findByIdAndUpdate(id, { isBlocked: false, $unset: { blockedUntil: 1, blockType: 1 } }, { new: true }).select('username isBlocked');
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        await (0, activity_log_service_1.logActivity)({
            actorId: req.adminUser.id,
            actorRole: req.adminUser.role,
            actionType: 'unblock_user',
            targetEntityType: 'User',
            targetEntityId: id,
            description: `Unblocked user ${user.username}`,
        });
        res.status(200).json({ success: true, user });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.unblockUser = unblockUser;
// ─── Suspend User ─────────────────────────────────────────────────────────────
const suspendUser = async (req, res) => {
    try {
        const id = String(req.params.id);
        const { suspend } = req.body;
        const user = await user_model_1.User.findByIdAndUpdate(id, { isSuspended: Boolean(suspend) }, { new: true }).select('username isSuspended');
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        if (suspend) {
            await live_model_1.default.updateMany({ hostId: id, isActive: true }, { isActive: false });
        }
        await (0, activity_log_service_1.logActivity)({
            actorId: req.adminUser.id,
            actorRole: req.adminUser.role,
            actionType: suspend ? 'suspend_user' : 'unsuspend_user',
            targetEntityType: 'User',
            targetEntityId: id,
            description: `${suspend ? 'Suspended' : 'Unsuspended'} user ${user.username}`,
        });
        res.status(200).json({ success: true, user });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.suspendUser = suspendUser;
