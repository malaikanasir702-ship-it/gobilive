"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPolicyLogs = listPolicyLogs;
exports.getPolicyLog = getPolicyLog;
exports.createPolicyLog = createPolicyLog;
const policy_log_model_1 = require("../policy/policy-log.model");
const activity_log_service_1 = require("../activity-log/activity-log.service");
async function listPolicyLogs(req, res) {
    try {
        const { policyName, page = 1, limit = 20, countryCode } = req.query;
        const filter = {};
        if (policyName)
            filter.policyName = policyName;
        if (countryCode)
            filter.countryCode = countryCode;
        const total = await policy_log_model_1.PolicyLog.countDocuments(filter);
        const data = await policy_log_model_1.PolicyLog.find(filter)
            .sort({ createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit))
            .populate('changedBy', 'username')
            .lean();
        res.json({ success: true, data, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function getPolicyLog(req, res) {
    try {
        const { id } = req.params;
        const doc = await policy_log_model_1.PolicyLog.findById(id).lean();
        if (!doc)
            return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data: doc });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function createPolicyLog(req, res) {
    try {
        const { policyName, previousValue, newValue, countryCode } = req.body;
        const changedBy = req.adminUser?.id;
        const changedByRole = req.adminUser?.role || 'company_admin';
        if (!policyName || newValue === undefined) {
            return res.status(400).json({ success: false, message: 'policyName and newValue required' });
        }
        const doc = await policy_log_model_1.PolicyLog.create({ policyName, previousValue, newValue, changedBy, countryCode });
        await (0, activity_log_service_1.logActivity)({
            actorId: changedBy, actorRole: changedByRole,
            actionType: 'update_policy', targetEntityType: 'PolicyLog', targetEntityId: doc._id.toString(),
            description: `Updated policy "${policyName}" to ${JSON.stringify(newValue)}`,
        });
        res.status(201).json({ success: true, data: doc });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
exports.default = {};
