"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.suspendUserByUsername = exports.suspendUserAdmin = exports.listStreamReports = exports.processWithdrawal = exports.listWithdrawals = exports.listPendingWithdrawals = exports.listPosts = exports.endStreamAdmin = exports.listActiveStreams = exports.rejectCoinSeller = exports.approveCoinSeller = exports.processAgencyPayout = exports.listAgencyPayouts = exports.listCoinSellers = exports.listAgencies = exports.updateSettings = exports.getSettings = exports.adjustUserWallet = exports.listUsers = exports.getDashboard = void 0;
const user_model_1 = require("../auth/user.model");
const live_model_1 = __importDefault(require("../live/live.model"));
const report_model_1 = __importDefault(require("../live/report.model"));
const wallet_transaction_model_1 = __importDefault(require("../wallet/wallet.transaction.model"));
const agency_model_1 = require("../agency/agency.model");
const notification_service_1 = require("../notifications/notification.service");
const coin_seller_model_1 = require("../coin-seller/coin-seller.model");
const agency_payout_model_1 = __importDefault(require("../agency/agency-payout.model"));
const platform_settings_model_1 = require("../settings/platform-settings.model");
const wallet_config_1 = require("../wallet/wallet.config");
const gift_config_1 = require("../gifts/gift.config");
const post_model_1 = require("../feed/post.model");
const getDashboard = async (_req, res) => {
    try {
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
        const [userCount, activeStreams, pendingWithdrawals, agencies, coinSellers, newUsers7d, activeUsers30d, pendingRegs, openSupportChats] = await Promise.all([
            user_model_1.User.countDocuments(),
            live_model_1.default.countDocuments({ isActive: true }),
            wallet_transaction_model_1.default.countDocuments({ type: 'withdraw_rcoins', status: 'pending' }),
            agency_model_1.Agency.countDocuments({ isActive: true }),
            coin_seller_model_1.CoinSeller.countDocuments({ isApproved: true }),
            user_model_1.User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
            wallet_transaction_model_1.default.distinct('userId', { createdAt: { $gte: thirtyDaysAgo } }).then((a) => a.length),
            (await Promise.resolve().then(() => __importStar(require('../registration/registration-request.model')))).RegistrationRequest.countDocuments({ status: 'pending' }),
            (await Promise.resolve().then(() => __importStar(require('../support/support-chat.model')))).SupportChat.countDocuments({ closedAt: { $exists: false } }),
        ]);
        const recentTx = await wallet_transaction_model_1.default.find()
            .sort({ createdAt: -1 })
            .limit(20)
            .populate('userId', 'username')
            .lean();
        // diamonds spent / purchased in last 30 days
        const diamondsAgg = await wallet_transaction_model_1.default.aggregate([
            { $match: { currency: 'diamonds', createdAt: { $gte: thirtyDaysAgo } } },
            {
                $group: {
                    _id: null,
                    purchased: { $sum: { $cond: [{ $eq: ['$type', 'purchase_diamonds'] }, '$amount', 0] } },
                    spent: { $sum: { $cond: [{ $lt: ['$diamondsDelta', 0] }, { $abs: '$diamondsDelta' }, 0] } },
                },
            },
        ]);
        const diamondsSummary = (diamondsAgg && diamondsAgg[0]) || { purchased: 0, spent: 0 };
        res.status(200).json({
            success: true,
            stats: {
                userCount,
                newUsers7d,
                activeUsers30d,
                activeStreams,
                pendingWithdrawals,
                pendingRegistrations: pendingRegs,
                openSupportChats,
                agencies,
                coinSellers,
            },
            diamondsSummary,
            recentTransactions: recentTx,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getDashboard = getDashboard;
const listUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 50;
        const users = await user_model_1.User.find()
            .select('-passwordHash -fcmTokens')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
        res.status(200).json({ success: true, users });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.listUsers = listUsers;
const adjustUserWallet = async (req, res) => {
    try {
        const { userId, diamonds, rcoins, reason } = req.body;
        const user = await user_model_1.User.findById(userId);
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        const diamondsDelta = diamonds ?? 0;
        const rcoinsDelta = rcoins ?? 0;
        user.diamonds += diamondsDelta;
        user.rcoins += rcoinsDelta;
        await user.save();
        await wallet_transaction_model_1.default.create({
            userId: user._id,
            type: 'admin_adjust',
            currency: diamondsDelta ? 'diamonds' : 'rcoins',
            amount: Math.abs(diamondsDelta || rcoinsDelta),
            diamondsDelta,
            rcoinsDelta,
            diamondsBalance: user.diamonds,
            rcoinsBalance: user.rcoins,
            status: 'completed',
            description: reason || 'Admin adjustment',
        });
        res.status(200).json({ success: true, user: { diamonds: user.diamonds, rcoins: user.rcoins } });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.adjustUserWallet = adjustUserWallet;
const getSettings = async (_req, res) => {
    const settings = await (0, platform_settings_model_1.getPlatformSettings)();
    res.status(200).json({
        success: true,
        settings,
        diamondPackages: wallet_config_1.DIAMOND_PACKAGES,
        vipPlans: wallet_config_1.VIP_PLANS,
        giftCatalog: gift_config_1.GIFT_CATALOG,
    });
};
exports.getSettings = getSettings;
const updateSettings = async (req, res) => {
    try {
        const settings = await (0, platform_settings_model_1.getPlatformSettings)();
        Object.assign(settings, req.body);
        await settings.save();
        res.status(200).json({ success: true, settings });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateSettings = updateSettings;
const listAgencies = async (_req, res) => {
    const agencies = await agency_model_1.Agency.find().sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, agencies });
};
exports.listAgencies = listAgencies;
const listCoinSellers = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '12', 10)));
        const q = req.query.q || '';
        const filter = {};
        if (q && q.trim().length > 0) {
            const re = new RegExp(q.trim(), 'i');
            filter.$or = [{ username: re }, { businessName: re }];
        }
        const total = await coin_seller_model_1.CoinSeller.countDocuments(filter);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const sellers = await coin_seller_model_1.CoinSeller.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
        res.status(200).json({ success: true, sellers, total, page, totalPages, limit });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.listCoinSellers = listCoinSellers;
const listAgencyPayouts = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '12', 10)));
        const q = req.query.q || '';
        const filter = {};
        if (q && q.trim().length > 0) {
            const re = new RegExp(q.trim(), 'i');
            filter.$or = [{ agencyName: re }, { method: re }];
            // allow numeric search on amount
            if (!isNaN(Number(q)))
                filter.$or.push({ amount: Number(q) });
        }
        const total = await agency_payout_model_1.default.countDocuments(filter);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const payouts = await agency_payout_model_1.default.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
        res.status(200).json({ success: true, payouts, total, page, totalPages, limit });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.listAgencyPayouts = listAgencyPayouts;
const processAgencyPayout = async (req, res) => {
    try {
        const { payoutId, status } = req.body;
        const payout = await agency_payout_model_1.default.findByIdAndUpdate(payoutId, { status }, { new: true });
        res.status(200).json({ success: true, payout });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.processAgencyPayout = processAgencyPayout;
const approveCoinSeller = async (req, res) => {
    const seller = await coin_seller_model_1.CoinSeller.findByIdAndUpdate(req.params.id, { isApproved: true }, { new: true });
    if (seller) {
        await user_model_1.User.findByIdAndUpdate(seller.userId, { role: 'coin_seller' });
    }
    res.status(200).json({ success: true, seller });
};
exports.approveCoinSeller = approveCoinSeller;
const rejectCoinSeller = async (req, res) => {
    try {
        const seller = await coin_seller_model_1.CoinSeller.findByIdAndUpdate(req.params.id, { isApproved: false }, { new: true });
        if (seller) {
            await user_model_1.User.findByIdAndUpdate(seller.userId, { role: 'user' });
        }
        res.status(200).json({ success: true, seller });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.rejectCoinSeller = rejectCoinSeller;
const listActiveStreams = async (_req, res) => {
    const streams = await live_model_1.default.find({ isActive: true }).sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, streams });
};
exports.listActiveStreams = listActiveStreams;
const endStreamAdmin = async (req, res) => {
    const room = await live_model_1.default.findOneAndUpdate({ channelName: req.params.channelName }, { isActive: false }, { new: true });
    res.status(200).json({ success: true, room });
};
exports.endStreamAdmin = endStreamAdmin;
const listPosts = async (_req, res) => {
    const posts = await post_model_1.Post.find().sort({ createdAt: -1 }).limit(100).lean();
    res.status(200).json({ success: true, posts });
};
exports.listPosts = listPosts;
const listPendingWithdrawals = async (_req, res) => {
    try {
        const withdrawals = await wallet_transaction_model_1.default.find({ type: 'withdraw_rcoins', status: 'pending' })
            .sort({ createdAt: -1 })
            .populate('userId', 'username')
            .lean();
        res.status(200).json({ success: true, withdrawals });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.listPendingWithdrawals = listPendingWithdrawals;
const listWithdrawals = async (req, res) => {
    try {
        const status = req.query.status?.toLowerCase();
        const query = { type: 'withdraw_rcoins' };
        if (status && status !== 'all') {
            query.status = status;
        }
        const withdrawals = await wallet_transaction_model_1.default.find(query)
            .sort({ createdAt: -1 })
            .populate('userId', 'username')
            .lean();
        res.status(200).json({ success: true, withdrawals });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.listWithdrawals = listWithdrawals;
const processWithdrawal = async (req, res) => {
    const { txId, status } = req.body;
    const tx = await wallet_transaction_model_1.default.findByIdAndUpdate(txId, { status }, { new: true }).lean();
    if (!tx) {
        res.status(404).json({ success: false, message: 'Withdrawal not found.' });
        return;
    }
    if (status === 'completed' && tx.userId) {
        await (0, notification_service_1.sendToUser)(tx.userId.toString(), notification_service_1.NotificationTriggers.withdrawalSubmitted(tx.amount));
    }
    if (status === 'failed' && tx.userId) {
        await (0, notification_service_1.sendToUser)(tx.userId.toString(), {
            title: 'Withdrawal Failed',
            body: 'Your withdrawal request could not be processed. Please contact support.',
            data: { type: 'withdrawal_failed' },
        });
    }
    res.status(200).json({ success: true, transaction: tx });
};
exports.processWithdrawal = processWithdrawal;
const listStreamReports = async (_req, res) => {
    try {
        const reports = await report_model_1.default.find().sort({ createdAt: -1 }).limit(200).lean();
        res.status(200).json({ success: true, reports });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.listStreamReports = listStreamReports;
const suspendUserAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const { suspend } = req.body; // boolean
        const user = await user_model_1.User.findByIdAndUpdate(id, { isSuspended: Boolean(suspend) }, { new: true });
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        // If suspending, also forcibly end their active stream
        if (suspend) {
            await live_model_1.default.updateMany({ hostId: id, isActive: true }, { isActive: false });
        }
        res.status(200).json({ success: true, isSuspended: user.isSuspended });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.suspendUserAdmin = suspendUserAdmin;
const suspendUserByUsername = async (req, res) => {
    try {
        const { username, suspend } = req.body;
        const user = await user_model_1.User.findOneAndUpdate({ username }, { isSuspended: Boolean(suspend) }, { new: true });
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        if (suspend) {
            await live_model_1.default.updateMany({ hostUsername: username, isActive: true }, { isActive: false });
        }
        res.status(200).json({ success: true, isSuspended: user.isSuspended });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.suspendUserByUsername = suspendUserByUsername;
