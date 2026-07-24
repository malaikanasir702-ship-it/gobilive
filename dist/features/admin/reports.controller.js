"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listReports = listReports;
exports.getReport = getReport;
exports.dismissReport = dismissReport;
exports.escalateReport = escalateReport;
const report_model_1 = __importDefault(require("../live/report.model"));
const user_model_1 = require("../auth/user.model");
const live_model_1 = __importDefault(require("../live/live.model"));
const activity_log_service_1 = require("../activity-log/activity-log.service");
const notification_service_1 = require("../notifications/notification.service");
async function listReports(req, res) {
    try {
        const { hostUsername, reporterUsername, page = 1, limit = 20, from, to } = req.query;
        const filter = {};
        if (hostUsername)
            filter.hostUsername = new RegExp(hostUsername, 'i');
        if (reporterUsername)
            filter.reporterUsername = new RegExp(reporterUsername, 'i');
        if (from || to) {
            filter.createdAt = {};
            if (from)
                filter.createdAt.$gte = new Date(from);
            if (to)
                filter.createdAt.$lte = new Date(to);
        }
        const total = await report_model_1.default.countDocuments(filter);
        const data = await report_model_1.default.find(filter)
            .sort({ createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit))
            .lean();
        res.json({ success: true, data, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function getReport(req, res) {
    try {
        const id = String(req.params.id);
        const rpt = await report_model_1.default.findById(id).lean();
        if (!rpt)
            return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data: rpt });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function dismissReport(req, res) {
    try {
        const id = String(req.params.id);
        const adminId = req.adminUser?.id || 'system';
        const adminRole = req.adminUser?.role || 'company_admin';
        const rpt = await report_model_1.default.findByIdAndDelete(id).lean();
        if (!rpt)
            return res.status(404).json({ success: false, message: 'Not found' });
        await (0, activity_log_service_1.logActivity)({
            actorId: adminId, actorRole: adminRole,
            actionType: 'dismiss_report', targetEntityType: 'StreamReport', targetEntityId: id,
            description: `Dismissed report against host ${rpt.hostUsername}`,
        });
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function escalateReport(req, res) {
    try {
        const id = String(req.params.id);
        const { action } = req.body; // 'suspend' | 'block' | 'terminate'
        const adminId = req.adminUser?.id || 'system';
        const adminRole = req.adminUser?.role || 'company_admin';
        const rpt = await report_model_1.default.findById(id);
        if (!rpt)
            return res.status(404).json({ success: false, message: 'Not found' });
        const host = await user_model_1.User.findOne({ username: rpt.hostUsername });
        if (!host)
            return res.status(404).json({ success: false, message: 'Host not found' });
        if (action === 'suspend') {
            host.isSuspended = true;
            await host.save();
            // End any active streams
            await live_model_1.default.updateMany({ hostId: host._id, isActive: true }, { isActive: false });
            await (0, notification_service_1.sendToUser)(host._id.toString(), {
                title: 'Account Suspended',
                body: 'Your account has been suspended due to a reported violation.',
                data: { type: 'account_suspended' },
            });
        }
        else if (action === 'block') {
            host.isBlocked = true;
            host.blockType = 'permanent';
            await host.save();
            await live_model_1.default.updateMany({ hostId: host._id, isActive: true }, { isActive: false });
        }
        else if (action === 'terminate') {
            host.isTerminated = true;
            await host.save();
            await live_model_1.default.updateMany({ hostId: host._id, isActive: true }, { isActive: false });
        }
        // Delete the report after action
        await report_model_1.default.findByIdAndDelete(id);
        await (0, activity_log_service_1.logActivity)({
            actorId: adminId, actorRole: adminRole,
            actionType: 'escalate_report', targetEntityType: 'User', targetEntityId: host._id.toString(),
            description: `Escalated report against host ${rpt.hostUsername} with action: ${action}`,
        });
        res.json({ success: true, action, hostId: host._id });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
exports.default = {};
