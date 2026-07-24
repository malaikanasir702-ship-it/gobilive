"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityLog = void 0;
const mongoose_1 = require("mongoose");
const ActivityLogSchema = new mongoose_1.Schema({
    actorId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    actorRole: { type: String, required: true },
    actionType: { type: String, required: true },
    targetEntityType: { type: String, required: true },
    targetEntityId: { type: String, required: true },
    description: { type: String, required: true },
    metadata: { type: mongoose_1.Schema.Types.Mixed },
}, { timestamps: { createdAt: true, updatedAt: false } });
ActivityLogSchema.index({ actorId: 1, createdAt: -1 });
ActivityLogSchema.index({ actionType: 1, createdAt: -1 });
ActivityLogSchema.index({ actorRole: 1, createdAt: -1 });
ActivityLogSchema.index({ targetEntityType: 1, targetEntityId: 1 });
exports.ActivityLog = (0, mongoose_1.model)('ActivityLog', ActivityLogSchema);
