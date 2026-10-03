"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Activity = void 0;
const mongoose_1 = require("mongoose");
const GroupedActorSchema = new mongoose_1.Schema({
    actorId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    profilePic: { type: String, default: '' },
    displayName: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
}, { _id: false });
const ActivitySchema = new mongoose_1.Schema({
    recipientId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    actorId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    actorUsername: { type: String, required: true, trim: true },
    actorProfilePic: { type: String, default: '' },
    actorDisplayName: { type: String, default: '' },
    type: {
        type: String,
        enum: [
            'profile_view',
            'follow',
            'follow_request',
            'follow_request_accepted',
            'like_post',
            'like_comment',
            'comment_post',
            'reply_comment',
            'mention',
            'tag',
            'save_post',
            'repost_post',
            'share_post',
            'live_gift',
        ],
        required: true,
    },
    postId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Post' },
    commentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Comment' },
    postThumbnailUrl: { type: String, default: '' },
    commentText: { type: String, default: '' },
    metadata: { type: mongoose_1.Schema.Types.Mixed },
    groupedActors: { type: [GroupedActorSchema], default: [] },
    count: { type: Number, default: 1 },
    isRead: { type: Boolean, default: false },
    idempotencyKey: { type: String, sparse: true, unique: true },
}, { timestamps: true });
// Indexes for fast chronological feed queries, category filters & unread badges
ActivitySchema.index({ recipientId: 1, createdAt: -1 });
ActivitySchema.index({ recipientId: 1, type: 1, createdAt: -1 });
ActivitySchema.index({ recipientId: 1, isRead: 1 });
ActivitySchema.index({ recipientId: 1, postId: 1, type: 1 });
exports.Activity = (0, mongoose_1.model)('Activity', ActivitySchema);
