"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostLike = void 0;
const mongoose_1 = require("mongoose");
const PostLikeSchema = new mongoose_1.Schema({
    postId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Post', required: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
});
// Prevent multiple likes by the same user on the same post.
PostLikeSchema.index({ postId: 1, userId: 1 }, { unique: true });
PostLikeSchema.index({ userId: 1, createdAt: -1 });
exports.PostLike = (0, mongoose_1.model)('PostLike', PostLikeSchema);
