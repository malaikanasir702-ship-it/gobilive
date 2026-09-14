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
exports.listTransactions = listTransactions;
exports.getTransaction = getTransaction;
exports.refundTransaction = refundTransaction;
exports.manualAdjust = manualAdjust;
const mongoose_1 = __importDefault(require("mongoose"));
const wallet_transaction_model_1 = __importDefault(require("../wallet/wallet.transaction.model"));
const bean_transaction_model_1 = require("../beans/bean-transaction.model");
const withdrawal_request_model_1 = require("../withdrawal/withdrawal-request.model");
const user_model_1 = require("../auth/user.model");
const activity_log_service_1 = require("../activity-log/activity-log.service");
// Universal tabbed transaction list
async function listTransactions(req, res) {
    try {
        const { tab = 'beans', page = 1, limit = 20, userId, hostName, agencyCode, agencyName, from, to, status } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const adminUser = req.adminUser;
        // Helper: get host IDs scoped to super/sub admin's agencies
        const getScopedHostIds = async () => {
            if (adminUser?.role !== 'super_admin' && adminUser?.role !== 'sub_admin')
                return null;
            const { Agency } = await Promise.resolve().then(() => __importStar(require('../agency/agency.model')));
            const agencyQuery = adminUser.role === 'super_admin'
                ? { superAdminId: adminUser.id }
                : { subAdminId: adminUser.id };
            const myAgencies = await Agency.find(agencyQuery).select('_id agencyCode').lean();
            if (!myAgencies.length)
                return [];
            const { User } = await Promise.resolve().then(() => __importStar(require('../auth/user.model')));
            const agencyRefs = myAgencies.flatMap((a) => [String(a._id), ...(a.agencyCode ? [a.agencyCode] : [])]);
            const hosts = await User.find({ agencyId: { $in: agencyRefs } }).select('_id').lean();
            return hosts.map((h) => String(h._id));
        };
        if (tab === 'beans') {
            const filter = {};
            if (userId)
                filter.$or = [{ fromId: userId }, { toId: userId }];
            if (status)
                filter.status = status;
            if (from || to) {
                filter.createdAt = {};
                if (from)
                    filter.createdAt.$gte = new Date(from);
                if (to)
                    filter.createdAt.$lte = new Date(to);
            }
            const hostIds = await getScopedHostIds();
            if (hostIds !== null) {
                if (!hostIds.length)
                    return res.json({ success: true, data: [], total: 0, page: Number(page), totalPages: 0 });
                filter.$or = [{ fromId: { $in: hostIds } }, { toId: { $in: hostIds } }];
            }
            const total = await bean_transaction_model_1.BeanTransaction.countDocuments(filter);
            const data = await bean_transaction_model_1.BeanTransaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean();
            return res.json({ success: true, data, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
        }
        if (tab === 'withdrawals') {
            const filter = {};
            if (hostName)
                filter.hostName = new RegExp(hostName, 'i');
            if (agencyCode)
                filter.agencyCode = new RegExp(agencyCode, 'i');
            if (status)
                filter.status = status;
            if (from || to) {
                filter.requestedAt = {};
                if (from)
                    filter.requestedAt.$gte = new Date(from);
                if (to)
                    filter.requestedAt.$lte = new Date(to);
            }
            const hostIds = await getScopedHostIds();
            if (hostIds !== null) {
                if (!hostIds.length)
                    return res.json({ success: true, data: [], total: 0, page: Number(page), totalPages: 0 });
                filter.hostId = { $in: hostIds };
            }
            const total = await withdrawal_request_model_1.WithdrawalRequest.countDocuments(filter);
            const data = await withdrawal_request_model_1.WithdrawalRequest.find(filter).sort({ requestedAt: -1 }).skip(skip).limit(Number(limit)).lean();
            return res.json({ success: true, data, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
        }
        // diamonds or d2b — WalletTransaction
        const filter = {};
        if (tab === 'diamonds')
            filter.currency = 'diamonds';
        if (tab === 'd2b')
            filter.type = 'convert_diamonds_to_rcoins';
        if (userId)
            filter.userId = userId;
        if (status)
            filter.status = status;
        if (from || to) {
            filter.createdAt = {};
            if (from)
                filter.createdAt.$gte = new Date(from);
            if (to)
                filter.createdAt.$lte = new Date(to);
        }
        const hostIds = await getScopedHostIds();
        if (hostIds !== null) {
            if (!hostIds.length)
                return res.json({ success: true, data: [], total: 0, page: Number(page), totalPages: 0 });
            filter.userId = { $in: hostIds };
        }
        const total = await wallet_transaction_model_1.default.countDocuments(filter);
        const data = await wallet_transaction_model_1.default.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .populate('userId', 'username email')
            .lean();
        res.json({ success: true, data, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function getTransaction(req, res) {
    try {
        const id = String(req.params.id);
        const doc = await wallet_transaction_model_1.default.findById(id).populate('userId', 'username email').lean();
        if (!doc)
            return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data: doc });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function refundTransaction(req, res) {
    const id = String(req.params.id);
    const adminId = req.adminUser?.id || 'system';
    const adminRole = req.adminUser?.role || 'company_admin';
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const orig = await wallet_transaction_model_1.default.findById(id).session(session);
        if (!orig) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ success: false, message: 'Not found' });
        }
        if (orig.status !== 'completed') {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: 'Only completed transactions can be refunded' });
        }
        const user = await user_model_1.User.findById(orig.userId).session(session);
        if (!user) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const diamondsDelta = -(orig.diamondsDelta || 0);
        const rcoinsDelta = -(orig.rcoinsDelta || 0);
        const newDiamonds = (user.diamonds || 0) + diamondsDelta;
        const newRcoins = (user.rcoins || 0) + rcoinsDelta;
        if (newDiamonds < 0 || newRcoins < 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: 'Refund would result in negative balance' });
        }
        user.diamonds = newDiamonds;
        user.rcoins = newRcoins;
        await user.save({ session });
        const refundTx = await wallet_transaction_model_1.default.create([{
                userId: user._id, type: 'admin_adjust', currency: orig.currency,
                amount: orig.amount, diamondsDelta, rcoinsDelta,
                diamondsBalance: user.diamonds, rcoinsBalance: user.rcoins,
                status: 'completed', description: `Refund for tx ${orig._id}`,
                metadata: { refundedTxId: orig._id.toString(), adminId },
            }], { session });
        orig.status = 'cancelled';
        await orig.save({ session });
        await session.commitTransaction();
        session.endSession();
        await (0, activity_log_service_1.logActivity)({
            actorId: adminId, actorRole: adminRole,
            actionType: 'refund_transaction', targetEntityType: 'WalletTransaction', targetEntityId: id,
            description: `Refunded transaction ${id} for user ${user.username}`,
        });
        res.json({ success: true, original: orig, refund: refundTx[0] });
    }
    catch (err) {
        await session.abortTransaction().catch(() => undefined);
        session.endSession();
        res.status(500).json({ success: false, message: err.message });
    }
}
async function manualAdjust(req, res) {
    const { userId, diamonds = 0, rcoins = 0, reason = 'manual adjustment' } = req.body;
    const adminId = req.adminUser?.id || 'system';
    const adminRole = req.adminUser?.role || 'company_admin';
    if (!userId)
        return res.status(400).json({ success: false, message: 'userId required' });
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const user = await user_model_1.User.findById(userId).session(session);
        if (!user) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        if ((user.diamonds || 0) + diamonds < 0 || (user.rcoins || 0) + rcoins < 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: 'Resulting balance would be negative' });
        }
        user.diamonds = (user.diamonds || 0) + diamonds;
        user.rcoins = (user.rcoins || 0) + rcoins;
        await user.save({ session });
        const tx = await wallet_transaction_model_1.default.create([{
                userId: user._id, type: 'admin_adjust',
                currency: diamonds !== 0 ? 'diamonds' : 'rcoins',
                amount: Math.abs(diamonds || rcoins),
                diamondsDelta: diamonds, rcoinsDelta: rcoins,
                diamondsBalance: user.diamonds, rcoinsBalance: user.rcoins,
                status: 'completed', description: `${reason}`, metadata: { adminId },
            }], { session });
        await session.commitTransaction();
        session.endSession();
        await (0, activity_log_service_1.logActivity)({
            actorId: adminId, actorRole: adminRole,
            actionType: 'manual_adjust', targetEntityType: 'User', targetEntityId: userId,
            description: `Manual adjust: diamonds ${diamonds}, rcoins ${rcoins}. Reason: ${reason}`,
        });
        res.json({ success: true, data: tx[0] });
    }
    catch (err) {
        await session.abortTransaction().catch(() => undefined);
        session.endSession();
        res.status(500).json({ success: false, message: err.message });
    }
}
exports.default = {};
