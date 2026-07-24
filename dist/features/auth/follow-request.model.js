"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FollowRequest = void 0;
const mongoose_1 = require("mongoose");
const FollowRequestSchema = new mongoose_1.Schema({
    fromId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    toId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending',
    },
}, { timestamps: true });
// One pending request per pair at a time
FollowRequestSchema.index({ fromId: 1, toId: 1 }, { unique: true });
FollowRequestSchema.index({ toId: 1, status: 1 });
exports.FollowRequest = (0, mongoose_1.model)('FollowRequest', FollowRequestSchema);
