"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromotionPackage = exports.PromotionCampaign = void 0;
const mongoose_1 = require("mongoose");
const PromotionCampaignSchema = new mongoose_1.Schema({
    promoterId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    postId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Post', required: true },
    goal: { type: String, enum: ['views', 'followers', 'visits'], default: 'views' },
    beansCost: { type: Number, required: true },
    targetCount: { type: Number, required: true },
    deliveredCount: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'completed', 'paused'], default: 'active' },
}, { timestamps: true });
PromotionCampaignSchema.index({ status: 1, postId: 1 });
exports.PromotionCampaign = (0, mongoose_1.model)('PromotionCampaign', PromotionCampaignSchema);
const PromotionPackageSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    goal: { type: String, enum: ['views', 'followers', 'visits'], default: 'views' },
    beansCost: { type: Number, required: true },
    estimatedReach: { type: Number, required: true },
    durationDays: { type: Number, default: 1 },
    badgeText: { type: String, default: '' },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
}, { timestamps: true });
PromotionPackageSchema.index({ isActive: 1, sortOrder: 1 });
exports.PromotionPackage = (0, mongoose_1.model)('PromotionPackage', PromotionPackageSchema);
