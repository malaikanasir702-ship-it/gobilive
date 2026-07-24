"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transferAgencies = exports.fireSuperAdmin = exports.unblockSuperAdmin = exports.blockSuperAdmin = exports.rejectSuperAdmin = exports.approveSuperAdmin = exports.listSuperAdmins = void 0;
const mongoose_1 = require("mongoose");
const user_model_1 = require("../auth/user.model");
const agency_model_1 = require("../agency/agency.model");
const activity_log_service_1 = require("../activity-log/activity-log.service");
// List Super Admins
const listSuperAdmins = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
        const filter = { role: 'super_admin' };
        const total = await user_model_1.User.countDocuments(filter);
        const items = await user_model_1.User.find(filter)
            .select('username email phone isBlocked isSuspended createdAt agencyId')
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
exports.listSuperAdmins = listSuperAdmins;
// Approve Super Admin (un-suspend / activate)
const approveSuperAdmin = async (req, res) => {
    try {
        const id = String(req.params.id);
        const user = await user_model_1.User.findByIdAndUpdate(id, { isSuspended: false, isTerminated: false }, { new: true }).select('username isSuspended isTerminated');
        if (!user) {
            res.status(404).json({ success: false, message: 'Super admin not found.' });
            return;
        }
        await (0, activity_log_service_1.logActivity)({
            actorId: req.adminUser.id,
            actorRole: req.adminUser.role,
            actionType: 'approve_super_admin',
            targetEntityType: 'User',
            targetEntityId: id,
            description: `Approved super admin ${user.username}`,
        });
        res.status(200).json({ success: true, user });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.approveSuperAdmin = approveSuperAdmin;
const rejectSuperAdmin = async (req, res) => {
    try {
        const id = String(req.params.id);
        const { reason } = req.body;
        const user = await user_model_1.User.findByIdAndUpdate(id, { isTerminated: true }, { new: true }).select('username isTerminated');
        if (!user) {
            res.status(404).json({ success: false, message: 'Super admin not found.' });
            return;
        }
        await (0, activity_log_service_1.logActivity)({
            actorId: req.adminUser.id,
            actorRole: req.adminUser.role,
            actionType: 'reject_super_admin',
            targetEntityType: 'User',
            targetEntityId: id,
            description: `Rejected super admin ${user.username}. Reason: ${reason || 'N/A'}`,
        });
        res.status(200).json({ success: true, user });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.rejectSuperAdmin = rejectSuperAdmin;
const blockSuperAdmin = async (req, res) => {
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
            res.status(404).json({ success: false, message: 'Super admin not found.' });
            return;
        }
        await (0, activity_log_service_1.logActivity)({
            actorId: req.adminUser.id,
            actorRole: req.adminUser.role,
            actionType: 'block_super_admin',
            targetEntityType: 'User',
            targetEntityId: id,
            description: `Blocked super admin ${user.username} (${update.blockType})`,
        });
        res.status(200).json({ success: true, user });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.blockSuperAdmin = blockSuperAdmin;
const unblockSuperAdmin = async (req, res) => {
    try {
        const id = String(req.params.id);
        const user = await user_model_1.User.findByIdAndUpdate(id, { isBlocked: false, $unset: { blockedUntil: 1, blockType: 1 } }, { new: true }).select('username isBlocked');
        if (!user) {
            res.status(404).json({ success: false, message: 'Super admin not found.' });
            return;
        }
        await (0, activity_log_service_1.logActivity)({
            actorId: req.adminUser.id,
            actorRole: req.adminUser.role,
            actionType: 'unblock_super_admin',
            targetEntityType: 'User',
            targetEntityId: id,
            description: `Unblocked super admin ${user.username}`,
        });
        res.status(200).json({ success: true, user });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.unblockSuperAdmin = unblockSuperAdmin;
// Fire super admin: set terminated and optionally transfer agencies
const fireSuperAdmin = async (req, res) => {
    try {
        const id = String(req.params.id);
        const { transferToSuperAdminId } = req.body;
        const user = await user_model_1.User.findByIdAndUpdate(id, { isTerminated: true }, { new: true }).select('username isTerminated');
        if (!user) {
            res.status(404).json({ success: false, message: 'Super admin not found.' });
            return;
        }
        if (transferToSuperAdminId) {
            if (!mongoose_1.Types.ObjectId.isValid(transferToSuperAdminId) || !mongoose_1.Types.ObjectId.isValid(id)) {
                res.status(400).json({ success: false, message: 'Invalid super admin id(s) provided.' });
                return;
            }
            await agency_model_1.Agency.updateMany({ superAdminId: new mongoose_1.Types.ObjectId(id) }, { $set: { superAdminId: new mongoose_1.Types.ObjectId(transferToSuperAdminId) } });
        }
        await (0, activity_log_service_1.logActivity)({
            actorId: req.adminUser.id,
            actorRole: req.adminUser.role,
            actionType: 'fire_super_admin',
            targetEntityType: 'User',
            targetEntityId: id,
            description: `Fired super admin ${user.username}`,
        });
        res.status(200).json({ success: true, user });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.fireSuperAdmin = fireSuperAdmin;
const transferAgencies = async (req, res) => {
    try {
        const fromSuperAdminId = String(req.params.fromSuperAdminId);
        const { toSuperAdminId, agencyIds } = req.body;
        if (!toSuperAdminId) {
            res.status(400).json({ success: false, message: 'toSuperAdminId is required.' });
            return;
        }
        if (!Array.isArray(agencyIds) || agencyIds.length === 0) {
            res.status(400).json({ success: false, message: 'agencyIds array is required.' });
            return;
        }
        if (!mongoose_1.Types.ObjectId.isValid(fromSuperAdminId) || !mongoose_1.Types.ObjectId.isValid(toSuperAdminId)) {
            res.status(400).json({ success: false, message: 'Invalid super admin id(s) provided.' });
            return;
        }
        const ids = agencyIds.map((a) => new mongoose_1.Types.ObjectId(a));
        const result = await agency_model_1.Agency.updateMany({ _id: { $in: ids }, superAdminId: new mongoose_1.Types.ObjectId(fromSuperAdminId) }, { $set: { superAdminId: new mongoose_1.Types.ObjectId(toSuperAdminId) } });
        await (0, activity_log_service_1.logActivity)({
            actorId: req.adminUser.id,
            actorRole: req.adminUser.role,
            actionType: 'transfer_agencies',
            targetEntityType: 'Agency',
            targetEntityId: fromSuperAdminId,
            description: `Transferred ${ids.length} agencies from ${fromSuperAdminId} to ${toSuperAdminId}`,
            metadata: { result },
        });
        res.status(200).json({ success: true, result });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.transferAgencies = transferAgencies;
