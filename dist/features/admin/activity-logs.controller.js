"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listActivityLogs = listActivityLogs;
exports.getActivityLog = getActivityLog;
exports.exportActivityLogs = exportActivityLogs;
const activity_log_model_1 = require("../activity-log/activity-log.model");
const mongoose_1 = require("mongoose");
async function listActivityLogs(req, res) {
    try {
        const { actorId, actorRole, actionType, targetEntityType, page = 1, limit = 50, from, to } = req.query;
        const filter = {};
        if (actorId && mongoose_1.Types.ObjectId.isValid(actorId))
            filter.actorId = new mongoose_1.Types.ObjectId(actorId);
        if (actorRole)
            filter.actorRole = actorRole;
        if (actionType)
            filter.actionType = actionType;
        if (targetEntityType)
            filter.targetEntityType = targetEntityType;
        if (from || to) {
            filter.createdAt = {};
            if (from)
                filter.createdAt.$gte = new Date(from);
            if (to)
                filter.createdAt.$lte = new Date(to);
        }
        const total = await activity_log_model_1.ActivityLog.countDocuments(filter);
        const data = await activity_log_model_1.ActivityLog.find(filter)
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
async function getActivityLog(req, res) {
    try {
        const { id } = req.params;
        const doc = await activity_log_model_1.ActivityLog.findById(id).lean();
        if (!doc)
            return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data: doc });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function exportActivityLogs(req, res) {
    try {
        const { actorRole, actionType, from, to } = req.query;
        const filter = {};
        if (actorRole)
            filter.actorRole = actorRole;
        if (actionType)
            filter.actionType = actionType;
        if (from || to) {
            filter.createdAt = {};
            if (from)
                filter.createdAt.$gte = new Date(from);
            if (to)
                filter.createdAt.$lte = new Date(to);
        }
        const docs = await activity_log_model_1.ActivityLog.find(filter).sort({ createdAt: -1 }).limit(10000).lean();
        if (!docs.length) {
            res.setHeader('Content-Type', 'text/csv');
            res.send('createdAt,actorId,actorRole,actionType,targetEntityType,targetEntityId,description\n');
            return;
        }
        const escape = (v) => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
        const header = 'createdAt,actorId,actorRole,actionType,targetEntityType,targetEntityId,description,metadata\n';
        const body = docs.map(d => [
            d.createdAt.toISOString(),
            d.actorId?.toString(),
            d.actorRole,
            d.actionType,
            d.targetEntityType,
            d.targetEntityId,
            d.description,
            JSON.stringify(d.metadata || {}),
        ].map(escape).join(',')).join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="activity_logs_${Date.now()}.csv"`);
        res.send(header + body);
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
exports.default = {};
