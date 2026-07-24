"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostSave = void 0;
const mongoose_1 = require("mongoose");
const PostSaveSchema = new mongoose_1.Schema({
    postId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Post', required: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
});
// One save per user per post
PostSaveSchema.index({ postId: 1, userId: 1 }, { unique: true });
PostSaveSchema.index({ userId: 1, createdAt: -1 });
exports.PostSave = (0, mongoose_1.model)('PostSave', PostSaveSchema);
