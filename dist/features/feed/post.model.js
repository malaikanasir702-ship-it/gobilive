"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Post = void 0;
const mongoose_1 = require("mongoose");
const PostSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    userProfilePic: { type: String, default: '' },
    postType: { type: String, enum: ['video', 'image'], default: 'video' },
    videoUrl: { type: String, default: '' },
    imageUrls: { type: [String], default: [] },
    thumbnailUrl: { type: String, default: '' },
    blurHash: { type: String, default: '' }, // e.g. "LGF5]+Yk^6#M@-5c,1J5@[or[Q6."
    aspectRatio: { type: Number, default: 0.5625 }, // default 9:16 portrait
    caption: { type: String, default: '' },
    location: { type: String, default: '' },
    allowComments: { type: Boolean, default: true },
    tags: [{ type: String }],
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    sharesCount: { type: Number, default: 0 },
    viewsCount: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
    isPublic: { type: Boolean, default: true },
    isArchived: { type: Boolean, default: false },
    // Moderation & Reporting & Appeals
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletionCategory: { type: String, default: '' },
    deletionReason: { type: String, default: '' },
    reportedCount: { type: Number, default: 0 },
    reports: [{
            userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
            category: { type: String, required: true },
            description: { type: String, default: '' },
            createdAt: { type: Date, default: Date.now },
        }],
    appealStatus: { type: String, enum: ['none', 'pending', 'accepted', 'rejected'], default: 'none' },
    appealReason: { type: String, default: '' },
    appealedAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
});
// Index for fast chronological feed queries & moderation queries
PostSchema.index({ createdAt: -1 });
PostSchema.index({ likesCount: -1 });
PostSchema.index({ isDeleted: 1 });
PostSchema.index({ reportedCount: -1 });
PostSchema.index({ appealStatus: 1 });
exports.Post = (0, mongoose_1.model)('Post', PostSchema);
