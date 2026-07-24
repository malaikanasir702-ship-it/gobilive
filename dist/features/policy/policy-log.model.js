"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolicyLog = void 0;
const mongoose_1 = require("mongoose");
const PolicyLogSchema = new mongoose_1.Schema({
    policyName: { type: String, required: true, index: true },
    previousValue: { type: mongoose_1.Schema.Types.Mixed },
    newValue: { type: mongoose_1.Schema.Types.Mixed, required: true },
    changedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    countryCode: { type: String },
}, { timestamps: { createdAt: true, updatedAt: false } });
PolicyLogSchema.index({ policyName: 1, createdAt: -1 });
exports.PolicyLog = (0, mongoose_1.model)('PolicyLog', PolicyLogSchema);
