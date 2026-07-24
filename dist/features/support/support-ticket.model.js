"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupportTicket = void 0;
const mongoose_1 = require("mongoose");
const SupportMessageSchema = new mongoose_1.Schema({
    senderId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String, required: true },
    senderName: { type: String, required: true },
    text: { type: String, required: true },
    attachmentUrl: { type: String },
    createdAt: { type: Date, default: Date.now },
}, { _id: true });
const SupportTicketSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    userName: { type: String, required: true },
    userProfilePic: { type: String, default: '' },
    messages: { type: [SupportMessageSchema], default: [] },
    status: { type: String, enum: ['open', 'resolved', 'closed'], default: 'open' },
    lastMessageAt: { type: Date, default: Date.now },
}, { timestamps: true });
SupportTicketSchema.index({ userId: 1 });
SupportTicketSchema.index({ status: 1, lastMessageAt: -1 });
exports.SupportTicket = (0, mongoose_1.model)('SupportTicket', SupportTicketSchema);
