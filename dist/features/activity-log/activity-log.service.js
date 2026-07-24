"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logActivity = logActivity;
const activity_log_model_1 = require("./activity-log.model");
/**
 * Fire-and-forget activity logger. Never throws — logs errors to console only.
 */
async function logActivity(params) {
    try {
        await activity_log_model_1.ActivityLog.create({
            actorId: params.actorId,
            actorRole: params.actorRole,
            actionType: params.actionType,
            targetEntityType: params.targetEntityType,
            targetEntityId: params.targetEntityId,
            description: params.description,
            metadata: params.metadata,
        });
    }
    catch (err) {
        console.error('[ActivityLog] Failed to write log:', err);
    }
}
