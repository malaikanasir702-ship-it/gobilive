"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Story = void 0;
const mongoose_1 = require("mongoose");
const StorySchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    userProfilePic: { type: String, default: '' },
    mediaUrl: { type: String, required: true },
    mediaType: { type: String, enum: ['image', 'video'], default: 'image' },
    viewedByUsers: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }],
    // TTL index: MongoDB automatically deletes the document 24 hours after createdAt
    createdAt: { type: Date, default: Date.now, expires: 86400 },
});
// Index for fast chronological queries per user
StorySchema.index({ userId: 1, createdAt: -1 });
exports.Story = (0, mongoose_1.model)('Story', StorySchema);
