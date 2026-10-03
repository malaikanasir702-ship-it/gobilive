"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Comment = void 0;
const mongoose_1 = require("mongoose");
const CommentSchema = new mongoose_1.Schema({
    postId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Post', required: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    userProfilePic: { type: String, default: '' },
    text: { type: String, required: true, trim: true },
    likesCount: { type: Number, default: 0 },
    dislikesCount: { type: Number, default: 0 },
    parentCommentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Comment', default: null },
    createdAt: { type: Date, default: Date.now },
});
CommentSchema.index({ postId: 1, parentCommentId: 1, createdAt: -1 });
exports.Comment = (0, mongoose_1.model)('Comment', CommentSchema);
