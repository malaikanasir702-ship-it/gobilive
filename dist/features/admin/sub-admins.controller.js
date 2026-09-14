"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listMyAgenciesForSubAdmin = exports.createAgencyBySubAdmin = exports.getSubAdminDetail = exports.unblockSubAdmin = exports.blockSubAdmin = exports.rejectSubAdmin = exports.approveSubAdmin = exports.listSubAdmins = void 0;
const mongoose_1 = require("mongoose");
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
// ── Sub Admin: Create Agency ──────────────────────────────────────────────────
// POST /sub-admins/my-agencies
// Accessible by sub_admin (creates agency under themselves) OR
// by super_admin/company_admin creating an agency for a specific sub admin.
const createAgencyBySubAdmin = async (req, res) => {
    try {
        const { name, agencyCode: providedCode, sharePercent, target, countryCode } = req.body;
        if (!name || !name.trim()) {
            res.status(400).json({ success: false, message: 'Agency name is required.' });
            return;
        }
        // Determine which sub_admin owns this agency
        // If called by sub_admin themselves → use their own id
        // If called by super_admin/company_admin → use subAdminId from body
        let subAdminId;
        let subAdminUser;
        if (req.adminUser.role === 'sub_admin') {
            subAdminId = req.adminUser.id;
            subAdminUser = await user_model_1.User.findById(subAdminId).select('username').lean();
        }
        else {
            // super_admin or company_admin specifying a sub admin
            const { subAdminId: bodySubAdminId } = req.body;
            if (!bodySubAdminId || !mongoose_1.Types.ObjectId.isValid(bodySubAdminId)) {
                res.status(400).json({ success: false, message: 'subAdminId is required when called by super/company admin.' });
                return;
            }
            subAdminId = String(bodySubAdminId);
            subAdminUser = await user_model_1.User.findById(subAdminId).select('username role').lean();
            if (!subAdminUser || subAdminUser.role !== 'sub_admin') {
                res.status(404).json({ success: false, message: 'Sub admin not found.' });
                return;
            }
        }
        if (!subAdminUser) {
            res.status(404).json({ success: false, message: 'Sub admin user not found.' });
            return;
        }
        // Auto-generate agencyCode if not provided
        const agencyCode = (providedCode && String(providedCode).trim())
            ? String(providedCode).trim().toUpperCase()
            : `AGC${Date.now().toString().slice(-6)}`;
        // Check agencyCode uniqueness
        const codeExists = await agency_model_1.Agency.findOne({ agencyCode }).select('_id').lean();
        if (codeExists) {
            res.status(409).json({ success: false, message: `Agency code "${agencyCode}" is already taken. Please choose a different one.` });
            return;
        }
        const agency = await agency_model_1.Agency.create({
            name: name.trim(),
            ownerId: subAdminId,
            ownerUsername: subAdminUser.username,
            agencyCode,
            status: 'active',
            isActive: true,
            subAdminId: subAdminId,
            sharePercent: sharePercent ? Number(sharePercent) : 3,
            target: target ? Number(target) : 0,
            countryCode: countryCode ? String(countryCode).toUpperCase() : '',
        });
        await (0, activity_log_service_1.logActivity)({
            actorId: req.adminUser.id,
            actorRole: req.adminUser.role,
            actionType: 'create_agency',
            targetEntityType: 'Agency',
            targetEntityId: String(agency._id),
            description: `Sub admin ${subAdminUser.username} created agency "${agency.name}" (${agency.agencyCode})`,
            metadata: { subAdminId },
        });
        res.status(201).json({ success: true, agency });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.createAgencyBySubAdmin = createAgencyBySubAdmin;
// ── Sub Admin: List Own Agencies ──────────────────────────────────────────────
// GET /sub-admins/my-agencies
const listMyAgenciesForSubAdmin = async (req, res) => {
    try {
        const subAdminId = req.adminUser.id;
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
        const filter = { subAdminId: new mongoose_1.Types.ObjectId(subAdminId) };
        const total = await agency_model_1.Agency.countDocuments(filter);
        const agencies = await agency_model_1.Agency.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
        res.status(200).json({ success: true, agencies, total, page, totalPages: Math.ceil(total / limit) });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.listMyAgenciesForSubAdmin = listMyAgenciesForSubAdmin;
