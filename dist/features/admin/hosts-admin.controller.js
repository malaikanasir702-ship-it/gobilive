"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transferHostAgency = exports.disapproveHost = exports.approveHost = exports.unblockHost = exports.blockHost = exports.getHostProfile = exports.listHosts = void 0;
const user_model_1 = require("../auth/user.model");
const agency_model_1 = require("../agency/agency.model");
const withdrawal_request_model_1 = require("../withdrawal/withdrawal-request.model");
const bean_transaction_model_1 = require("../beans/bean-transaction.model");
const live_model_1 = __importDefault(require("../live/live.model"));
const activity_log_service_1 = require("../activity-log/activity-log.service");
const mongoose_1 = require("mongoose");
const listHosts = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
        const search = req.query.search || '';
        const agency = req.query.agency || '';
        const status = req.query.status || '';
        const filter = { agencyId: { $exists: true, $ne: null } };
        if (search) {
            const re = new RegExp(search, 'i');
            filter.$or = [{ username: re }];
        }
        if (status === 'blocked')
            filter.isBlocked = true;
        if (status === 'suspended')
            filter.isSuspended = true;
        // Agency role: only show hosts belonging to their own agency
        const role = req.adminUser?.role;
        if (role === 'agency' || role === 'sub_agency') {
            const ownAgency = await agency_model_1.Agency.findOne({ ownerId: req.adminUser.id }).select('_id agencyCode').lean();
            if (!ownAgency) {
                res.status(200).json({ success: true, hosts: [], total: 0, page, totalPages: 0 });
                return;
            }
            // Filter by agency ObjectId or agencyCode (hosts may store either)
            filter.agencyId = {
                $in: [String(ownAgency._id), ownAgency.agencyCode],
            };
        }
        else {
            // super_admin / company_admin / sub_admin: allow optional agency filter from query
            if (agency)
                filter.agencyId = agency;
        }
        const total = await user_model_1.User.countDocuments(filter);
        const hosts = await user_model_1.User.find(filter)
            .select('username email phone diamonds beanWallet agencyId isBlocked isSuspended createdAt profilePic')
            .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
        // Resolve agency names — agencyId may be ObjectId or agencyCode string
        const agencyIds = [...new Set(hosts.map(h => h.agencyId).filter(Boolean))];
        const agencyDocs = await agency_model_1.Agency.find({
            $or: [
                { _id: { $in: agencyIds.filter(id => mongoose_1.Types.ObjectId.isValid(String(id))) } },
                { agencyCode: { $in: agencyIds.map(String) } },
            ],
        }).select('_id agencyCode name').lean();
        const agencyMap = new Map();
        for (const a of agencyDocs) {
            agencyMap.set(String(a._id), a.name);
            agencyMap.set(a.agencyCode, a.name);
        }
        const hostsWithAgency = hosts.map(h => ({
            ...h,
            agencyName: h.agencyId ? (agencyMap.get(String(h.agencyId)) ?? '—') : '—',
            agencyCode: h.agencyId ? (() => {
                const agency = agencyDocs.find(a => String(a._id) === String(h.agencyId) || a.agencyCode === String(h.agencyId));
                return agency?.agencyCode ?? String(h.agencyId);
            })() : '—',
        }));
        res.status(200).json({ success: true, hosts: hostsWithAgency, total, page, totalPages: Math.ceil(total / limit) });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.listHosts = listHosts;
const getHostProfile = async (req, res) => {
    try {
        const id = String(req.params.id);
        const user = await user_model_1.User.findById(id).select('-passwordHash -fcmTokens -twoFactorSecret -twoFactorPendingSecret').lean();
        if (!user) {
            res.status(404).json({ success: false, message: 'Host not found.' });
            return;
        }
        const [withdrawals, beanTxs, liveRooms] = await Promise.all([
            withdrawal_request_model_1.WithdrawalRequest.find({ hostId: id }).sort({ createdAt: -1 }).limit(50).lean(),
            bean_transaction_model_1.BeanTransaction.find({ toId: id }).sort({ createdAt: -1 }).limit(50).lean(),
            live_model_1.default.find({ hostId: id }).sort({ createdAt: -1 }).limit(20).lean(),
        ]);
        res.status(200).json({ success: true, user, withdrawals, beanTransactions: beanTxs, liveHistory: liveRooms });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getHostProfile = getHostProfile;
const blockHost = async (req, res) => {
    try {
        const id = String(req.params.id);
        const { type, duration } = req.body;
        const update = { isBlocked: true };
        if (type === 'temporary' && duration) {
            const hours = parseInt(duration, 10) || 24;
            update.blockedUntil = new Date(Date.now() + hours * 3600 * 1000);
            update.blockType = 'temporary';
        }
        else if (type === 'permanent') {
            update.blockType = 'permanent';
            update.$unset = { blockedUntil: 1 };
        }
        const user = await user_model_1.User.findByIdAndUpdate(id, update, { new: true }).select('username isBlocked blockedUntil blockType');
        if (!user) {
            res.status(404).json({ success: false, message: 'Host not found.' });
            return;
        }
        if (update.blockType === 'permanent')
            await live_model_1.default.updateMany({ hostId: id, isActive: true }, { isActive: false });
        await (0, activity_log_service_1.logActivity)({ actorId: req.adminUser.id, actorRole: req.adminUser.role, actionType: 'block_host', targetEntityType: 'User', targetEntityId: id, description: `Blocked host ${user.username}` });
        res.status(200).json({ success: true, user });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.blockHost = blockHost;
const unblockHost = async (req, res) => {
    try {
        const id = String(req.params.id);
        const user = await user_model_1.User.findByIdAndUpdate(id, { isBlocked: false, $unset: { blockedUntil: 1, blockType: 1 } }, { new: true }).select('username isBlocked');
        if (!user) {
            res.status(404).json({ success: false, message: 'Host not found.' });
            return;
        }
        await (0, activity_log_service_1.logActivity)({ actorId: req.adminUser.id, actorRole: req.adminUser.role, actionType: 'unblock_host', targetEntityType: 'User', targetEntityId: id, description: `Unblocked host ${user.username}` });
        res.status(200).json({ success: true, user });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.unblockHost = unblockHost;
const approveHost = async (req, res) => {
    try {
        const id = String(req.params.id);
        const user = await user_model_1.User.findByIdAndUpdate(id, { isSuspended: false }, { new: true }).select('username isSuspended');
        if (!user) {
            res.status(404).json({ success: false, message: 'Host not found.' });
            return;
        }
        await (0, activity_log_service_1.logActivity)({ actorId: req.adminUser.id, actorRole: req.adminUser.role, actionType: 'approve_host', targetEntityType: 'User', targetEntityId: id, description: `Approved host ${user.username}` });
        res.status(200).json({ success: true, user });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.approveHost = approveHost;
const disapproveHost = async (req, res) => {
    try {
        const id = String(req.params.id);
        const { reason } = req.body;
        const user = await user_model_1.User.findByIdAndUpdate(id, { isTerminated: true }, { new: true }).select('username isTerminated');
        if (!user) {
            res.status(404).json({ success: false, message: 'Host not found.' });
            return;
        }
        await (0, activity_log_service_1.logActivity)({ actorId: req.adminUser.id, actorRole: req.adminUser.role, actionType: 'disapprove_host', targetEntityType: 'User', targetEntityId: id, description: `Disapproved host ${user.username}. Reason: ${reason || 'N/A'}` });
        res.status(200).json({ success: true, user });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.disapproveHost = disapproveHost;
const transferHostAgency = async (req, res) => {
    try {
        const id = String(req.params.id);
        const { targetAgencyId } = req.body;
        if (!targetAgencyId) {
            res.status(400).json({ success: false, message: 'targetAgencyId is required.' });
            return;
        }
        const user = await user_model_1.User.findByIdAndUpdate(id, { agencyId: targetAgencyId }, { new: true }).select('username agencyId');
        if (!user) {
            res.status(404).json({ success: false, message: 'Host not found.' });
            return;
        }
        await (0, activity_log_service_1.logActivity)({ actorId: req.adminUser.id, actorRole: req.adminUser.role, actionType: 'transfer_host_agency', targetEntityType: 'User', targetEntityId: id, description: `Transferred host ${user.username} to agency ${targetAgencyId}` });
        res.status(200).json({ success: true, user });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.transferHostAgency = transferHostAgency;
