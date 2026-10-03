"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromotionCampaign = void 0;
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
