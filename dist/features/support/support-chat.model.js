"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupportChat = void 0;
const mongoose_1 = require("mongoose");
const SupportMessageSchema = new mongoose_1.Schema({
    senderId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String, required: true },
    message: { type: String, required: true },
    attachmentUrl: { type: String },
    createdAt: { type: Date, default: Date.now },
}, { _id: true });
const SupportChatSchema = new mongoose_1.Schema({
    agencyId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Agency', required: true },
    participantId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    participantRole: { type: String, enum: ['host', 'user'], required: true },
    messages: { type: [SupportMessageSchema], default: [] },
    lastMessageAt: { type: Date, default: Date.now },
}, { timestamps: { createdAt: true, updatedAt: false } });
SupportChatSchema.index({ agencyId: 1, lastMessageAt: -1 });
SupportChatSchema.index({ participantId: 1 });
exports.SupportChat = (0, mongoose_1.model)('SupportChat', SupportChatSchema);
