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
exports.listWithdrawals = listWithdrawals;
exports.getWithdrawal = getWithdrawal;
exports.approveWithdrawal = approveWithdrawal;
exports.rejectWithdrawal = rejectWithdrawal;
exports.markWithdrawalDone = markWithdrawalDone;
exports.attachTransferSlip = attachTransferSlip;
exports.attachSlipFile = attachSlipFile;
const mongoose_1 = __importDefault(require("mongoose"));
const withdrawal_request_model_1 = require("../withdrawal/withdrawal-request.model");
const activity_log_service_1 = require("../activity-log/activity-log.service");
const wallet_transaction_model_1 = __importDefault(require("../wallet/wallet.transaction.model"));
const user_model_1 = require("../auth/user.model");
const notification_service_1 = require("../notifications/notification.service");
async function listWithdrawals(req, res) {
    try {
        const { status, hostName, agencyId, page = 1, limit = 20, from, to } = req.query;
        const adminUser = req.adminUser;
        const filter = {};
        if (status)
            filter.status = status;
        if (hostName)
            filter.hostName = new RegExp(hostName, 'i');
        if (from || to) {
            filter.requestedAt = {};
            if (from)
                filter.requestedAt.$gte = new Date(from);
            if (to)
                filter.requestedAt.$lte = new Date(to);
        }
        // super_admin / sub_admin: scope to their own agencies' hosts
        if (adminUser?.role === 'super_admin' || adminUser?.role === 'sub_admin') {
            const agencyQuery = adminUser.role === 'super_admin'
                ? { superAdminId: adminUser.id }
                : { subAdminId: adminUser.id };
            const myAgencies = await (await Promise.resolve().then(() => __importStar(require('../agency/agency.model')))).Agency.find(agencyQuery).select('_id').lean();
            const agencyIds = myAgencies.map((a) => String(a._id));
            if (!agencyIds.length) {
                return res.json({ success: true, data: [], total: 0, page: Number(page), totalPages: 0 });
            }
            filter.agencyId = { $in: agencyIds };
        }
        else if (agencyId) {
            filter.agencyId = agencyId;
        }
        const total = await withdrawal_request_model_1.WithdrawalRequest.countDocuments(filter);
        const docs = await withdrawal_request_model_1.WithdrawalRequest.find(filter)
            .sort({ requestedAt: -1 })
            .skip((page - 1) * Number(limit))
            .limit(Number(limit))
            .lean();
        res.json({ success: true, data: docs, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function getWithdrawal(req, res) {
    try {
        const id = String(req.params.id);
        const doc = await withdrawal_request_model_1.WithdrawalRequest.findById(id).lean();
        if (!doc)
            return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data: doc });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function approveWithdrawal(req, res) {
    try {
        const id = String(req.params.id);
        const adminId = req.adminUser?.id || 'system';
        const adminRole = req.adminUser?.role || 'super_admin';
        const doc = await withdrawal_request_model_1.WithdrawalRequest.findByIdAndUpdate(id, { status: 'approved', approvedAt: new Date(), superAdminId: adminId }, { new: true });
        if (!doc)
            return res.status(404).json({ success: false, message: 'Not found' });
        await (0, activity_log_service_1.logActivity)({
            actorId: adminId, actorRole: adminRole,
            actionType: 'approve_withdrawal', targetEntityType: 'WithdrawalRequest', targetEntityId: id,
            description: `Approved withdrawal of ${doc.diamondsRequested} diamonds for ${doc.hostName}`,
        });
        // Notify host
        (0, notification_service_1.sendToUser)(String(doc.hostId), {
            title: '✅ Withdrawal Approved',
            body: `Your withdrawal of ${doc.diamondsRequested} 💎 (${doc.amountInLocalCurrency} ${doc.currencyCode}) has been approved and will be processed soon.`,
            data: { type: 'withdrawal_approved', withdrawalId: id },
        }).catch(() => { });
        res.json({ success: true, data: doc });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function rejectWithdrawal(req, res) {
    try {
        const id = String(req.params.id);
        const { reason } = req.body;
        const adminId = req.adminUser?.id || 'system';
        const adminRole = req.adminUser?.role || 'super_admin';
        const doc = await withdrawal_request_model_1.WithdrawalRequest.findByIdAndUpdate(id, { status: 'rejected', rejectionReason: reason }, { new: true });
        if (!doc)
            return res.status(404).json({ success: false, message: 'Not found' });
        if (doc.diamondsRequested > 0) {
            await user_model_1.User.updateOne({ _id: doc.hostId }, { $inc: { diamonds: doc.diamondsRequested } });
        }
        await (0, activity_log_service_1.logActivity)({
            actorId: adminId, actorRole: adminRole,
            actionType: 'reject_withdrawal', targetEntityType: 'WithdrawalRequest', targetEntityId: id,
            description: `Rejected withdrawal for ${doc.hostName}. Reason: ${reason || 'N/A'}`,
        });
        // Notify host — diamonds restored
        (0, notification_service_1.sendToUser)(String(doc.hostId), {
            title: '❌ Withdrawal Rejected',
            body: `Your withdrawal of ${doc.diamondsRequested} 💎 was rejected. ${reason ? `Reason: ${reason}` : ''} Your diamonds have been returned.`,
            data: { type: 'withdrawal_rejected', withdrawalId: id },
        }).catch(() => { });
        res.json({ success: true, data: doc });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function markWithdrawalDone(req, res) {
    const id = String(req.params.id);
    const adminId = req.adminUser?.id || 'system';
    const adminRole = req.adminUser?.role || 'super_admin';
    const slipFile = req.file;
    const { transferSlipUrl: slipUrlBody } = req.body;
    const slipUrl = slipFile
        ? `${req.protocol}://${req.get('host')}/uploads/${slipFile.filename}`
        : slipUrlBody;
    if (!slipUrl) {
        res.status(400).json({ success: false, message: 'Transfer slip (file or URL) is required to mark withdrawal as done.' });
        return;
    }
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const withdrawal = await withdrawal_request_model_1.WithdrawalRequest.findById(id).session(session);
        if (!withdrawal) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ success: false, message: 'Not found' });
        }
        if (withdrawal.status === 'done') {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: 'Already completed' });
        }
        const user = await user_model_1.User.findById(withdrawal.hostId).session(session);
        if (!user) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ success: false, message: 'Host user not found' });
        }
        withdrawal.transferSlipUrl = slipUrl;
        withdrawal.status = 'done';
        withdrawal.completedAt = new Date();
        await withdrawal.save({ session });
        await wallet_transaction_model_1.default.create([{
                userId: user._id,
                type: 'withdraw_rcoins',
                currency: 'diamonds',
                amount: withdrawal.amountInLocalCurrency,
                diamondsDelta: -withdrawal.diamondsRequested,
                rcoinsDelta: 0,
                diamondsBalance: user.diamonds,
                rcoinsBalance: user.rcoins,
                status: 'completed',
                description: `Withdrawal payout - ${withdrawal.amountInLocalCurrency} ${withdrawal.currencyCode}`,
                transferSlipUrl: slipUrl,
            }], { session });
        await session.commitTransaction();
        session.endSession();
        await (0, activity_log_service_1.logActivity)({
            actorId: adminId, actorRole: adminRole,
            actionType: 'complete_withdrawal', targetEntityType: 'WithdrawalRequest', targetEntityId: id,
            description: `Completed withdrawal of ${withdrawal.diamondsRequested} diamonds for ${withdrawal.hostName}`,
            metadata: { slipUrl },
        });
        // Notify host — payout done
        (0, notification_service_1.sendToUser)(String(withdrawal.hostId), {
            title: '💰 Payout Sent!',
            body: `Your withdrawal of ${withdrawal.amountInLocalCurrency} ${withdrawal.currencyCode} has been sent to your bank. Transfer slip uploaded.`,
            data: { type: 'withdrawal_done', withdrawalId: id, slipUrl: slipUrl ?? '' },
        }).catch(() => { });
        res.json({ success: true, data: withdrawal });
    }
    catch (err) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ success: false, message: err.message });
    }
}
async function attachTransferSlip(req, res) {
    try {
        const id = String(req.params.id);
        const { transferSlipUrl } = req.body;
        if (!transferSlipUrl)
            return res.status(400).json({ success: false, message: 'transferSlipUrl required' });
        const doc = await withdrawal_request_model_1.WithdrawalRequest.findByIdAndUpdate(id, { transferSlipUrl }, { new: true });
        if (!doc)
            return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data: doc });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function attachSlipFile(req, res) {
    try {
        const id = String(req.params.id);
        const file = req.file;
        if (!file)
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        const url = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
        const doc = await withdrawal_request_model_1.WithdrawalRequest.findByIdAndUpdate(id, { transferSlipUrl: url }, { new: true });
        if (!doc)
            return res.status(404).json({ success: false, message: 'Not found' });
        res.status(201).json({ success: true, url, data: doc });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
exports.default = {};
