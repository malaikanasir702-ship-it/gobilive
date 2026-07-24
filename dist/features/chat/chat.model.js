"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Conversation = exports.Message = void 0;
const mongoose_1 = require("mongoose");
const MessageSchema = new mongoose_1.Schema({
    conversationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    senderId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    senderUsername: { type: String, required: true },
    text: { type: String, default: '' },
    mediaUrl: { type: String },
    mediaType: { type: String, enum: ['image', 'sticker'] },
    status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
    isUnsent: { type: Boolean, default: false },
}, { timestamps: true });
exports.Message = (0, mongoose_1.model)('Message', MessageSchema);
const ConversationSchema = new mongoose_1.Schema({
    participants: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true }],
    participantUsernames: [{ type: String }],
    lastMessage: { type: String },
    lastMessageAt: { type: Date },
}, { timestamps: true });
ConversationSchema.index({ participants: 1 });
exports.Conversation = (0, mongoose_1.model)('Conversation', ConversationSchema);
