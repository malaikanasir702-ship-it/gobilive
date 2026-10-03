"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommentLike = void 0;
const mongoose_1 = require("mongoose");
const CommentLikeSchema = new mongoose_1.Schema({
    commentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Comment', required: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    reaction: { type: String, enum: ['like', 'dislike'], required: true },
    createdAt: { type: Date, default: Date.now },
});
// One reaction per user per comment
CommentLikeSchema.index({ commentId: 1, userId: 1 }, { unique: true });
exports.CommentLike = (0, mongoose_1.model)('CommentLike', CommentLikeSchema);
