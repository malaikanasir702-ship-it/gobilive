"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Follow = void 0;
const mongoose_1 = require("mongoose");
const FollowSchema = new mongoose_1.Schema({
    followerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    followingId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
FollowSchema.index({ followerId: 1, followingId: 1 }, { unique: true });
exports.Follow = (0, mongoose_1.model)('Follow', FollowSchema);
