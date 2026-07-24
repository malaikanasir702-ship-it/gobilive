"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSubAdminDetail = exports.unblockSubAdmin = exports.blockSubAdmin = exports.rejectSubAdmin = exports.approveSubAdmin = exports.listSubAdmins = void 0;
const user_model_1 = require("../auth/user.model");
const agency_model_1 = require("../agency/agency.model");
const activity_log_service_1 = require("../activity-log/activity-log.service");
const listSubAdmins = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
        const filter = { role: 'sub_admin' };
        const total = await user_model_1.User.countDocuments(filter);
        const items = await user_model_1.User.find(filter)
            .select('username email phone isBlocked isSuspended createdAt agencyId sharePercent')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
        res.status(200).json({ success: true, items, total, page, totalPages: Math.ceil(total / limit) });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.listSubAdmins = listSubAdmins;
const approveSubAdmin = async (req, res) => {
    try {
        const id = String(req.params.id);
        const user = await user_model_1.User.findByIdAndUpdate(id, { isSuspended: false }, { new: true }).select('username isSuspended');
        if (!user) {
            res.status(404).json({ success: false, message: 'Sub admin not found.' });
            return;
        }
        await (0, activity_log_service_1.logActivity)({
            actorId: req.adminUser.id,
            actorRole: req.adminUser.role,
            actionType: 'approve_sub_admin',
            targetEntityType: 'User',
            targetEntityId: id,
            description: `Approved sub admin ${user.username}`,
        });
        res.status(200).json({ success: true, user });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.approveSubAdmin = approveSubAdmin;
const rejectSubAdmin = async (req, res) => {
    try {
        const id = String(req.params.id);
        const { reason } = req.body;
        const user = await user_model_1.User.findByIdAndUpdate(id, { isTerminated: true }, { new: true }).select('username isTerminated');
        if (!user) {
            res.status(404).json({ success: false, message: 'Sub admin not found.' });
            return;
        }
        await (0, activity_log_service_1.logActivity)({
            actorId: req.adminUser.id,
            actorRole: req.adminUser.role,
            actionType: 'reject_sub_admin',
            targetEntityType: 'User',
            targetEntityId: id,
            description: `Rejected sub admin ${user.username}. Reason: ${reason || 'N/A'}`,
        });
        res.status(200).json({ success: true, user });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.rejectSubAdmin = rejectSubAdmin;
const blockSubAdmin = async (req, res) => {
    try {
        const id = String(req.params.id);
        const { type, durationHours } = req.body;
        const update = { isBlocked: true };
        if (type === 'temporary' && durationHours) {
            update.blockedUntil = new Date(Date.now() + Number(durationHours) * 60 * 60 * 1000);
            update.blockType = 'temporary';
        }
        else if (type === 'permanent') {
            update.blockType = 'permanent';
            update.$unset = { blockedUntil: 1 };
        }
        const user = await user_model_1.User.findByIdAndUpdate(id, update, { new: true }).select('username isBlocked blockedUntil blockType');
        if (!user) {
            res.status(404).json({ success: false, message: 'Sub admin not found.' });
            return;
        }
        await (0, activity_log_service_1.logActivity)({
            actorId: req.adminUser.id,
            actorRole: req.adminUser.role,
            actionType: 'block_sub_admin',
            targetEntityType: 'User',
            targetEntityId: id,
            description: `Blocked sub admin ${user.username} (${update.blockType})`,
        });
        res.status(200).json({ success: true, user });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.blockSubAdmin = blockSubAdmin;
const unblockSubAdmin = async (req, res) => {
    try {
        const id = String(req.params.id);
        const user = await user_model_1.User.findByIdAndUpdate(id, { isBlocked: false, $unset: { blockedUntil: 1, blockType: 1 } }, { new: true }).select('username isBlocked');
        if (!user) {
            res.status(404).json({ success: false, message: 'Sub admin not found.' });
            return;
        }
        await (0, activity_log_service_1.logActivity)({
            actorId: req.adminUser.id,
            actorRole: req.adminUser.role,
            actionType: 'unblock_sub_admin',
            targetEntityType: 'User',
            targetEntityId: id,
            description: `Unblocked sub admin ${user.username}`,
        });
        res.status(200).json({ success: true, user });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.unblockSubAdmin = unblockSubAdmin;
const getSubAdminDetail = async (req, res) => {
    try {
        const id = String(req.params.id);
        const user = await user_model_1.User.findById(id).select('-passwordHash').lean();
        if (!user) {
            res.status(404).json({ success: false, message: 'Sub admin not found.' });
            return;
        }
        const agencies = await agency_model_1.Agency.find({ subAdminId: id }).limit(50).lean();
        res.status(200).json({ success: true, user, agencies });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getSubAdminDetail = getSubAdminDetail;
