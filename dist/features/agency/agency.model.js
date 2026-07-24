"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Agency = void 0;
const mongoose_1 = require("mongoose");
const AgencySchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    ownerId: { type: String, required: true },
    ownerUsername: { type: String, required: true },
    commissionPercent: { type: Number, default: 15 },
    walletBalance: { type: Number, default: 0 },
    streamerIds: { type: [String], default: [] },
    totalEarnings: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    // Admin panel extensions
    agencyCode: { type: String, unique: true, sparse: true },
    parentAgencyId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Agency', sparse: true },
    subAgencyIds: { type: [mongoose_1.Schema.Types.ObjectId], ref: 'Agency', default: [] },
    target: { type: Number, default: 0 },
    targetAchieved: { type: Number, default: 0 },
    sharePercent: { type: Number, default: 0 },
    countryCode: { type: String, default: '' },
    status: { type: String, enum: ['active', 'terminated', 'blocked'], default: 'active' },
    superAdminId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', sparse: true },
    subAdminId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', sparse: true },
}, { timestamps: true });
AgencySchema.index({ targetAchieved: -1 });
AgencySchema.index({ superAdminId: 1 });
exports.Agency = (0, mongoose_1.model)('Agency', AgencySchema);
