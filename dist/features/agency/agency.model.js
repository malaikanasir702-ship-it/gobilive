"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Agency = exports.AGENCY_TIERS = void 0;
exports.getAgencyRankTier = getAgencyRankTier;
const mongoose_1 = require("mongoose");
exports.AGENCY_TIERS = [
    { tier: 'Platinum', minBeans: 200_000_000, sharePercent: 15 },
    { tier: 'Diamond', minBeans: 100_000_000, sharePercent: 12 },
    { tier: 'Gold', minBeans: 25_000_000, sharePercent: 8 },
    { tier: 'Copper', minBeans: 5_000_000, sharePercent: 5 },
    { tier: 'Silver', minBeans: 0, sharePercent: 3 },
];
function getAgencyRankTier(monthlyBeans) {
    for (const t of exports.AGENCY_TIERS) {
        if (monthlyBeans >= t.minBeans) {
            return t;
        }
    }
    return exports.AGENCY_TIERS[exports.AGENCY_TIERS.length - 1];
}
const AgencySchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    ownerId: { type: String, required: true },
    ownerUsername: { type: String, required: true },
    commissionPercent: { type: Number, default: 3 },
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
    sharePercent: { type: Number, default: 3 },
    rankTier: { type: String, enum: ['Silver', 'Copper', 'Gold', 'Diamond', 'Platinum'], default: 'Silver' },
    countryCode: { type: String, default: '' },
    status: { type: String, enum: ['active', 'terminated', 'blocked'], default: 'active' },
    superAdminId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', sparse: true },
    subAdminId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', sparse: true },
}, { timestamps: true });
AgencySchema.index({ targetAchieved: -1 });
AgencySchema.index({ superAdminId: 1 });
AgencySchema.index({ rankTier: 1 });
exports.Agency = (0, mongoose_1.model)('Agency', AgencySchema);
