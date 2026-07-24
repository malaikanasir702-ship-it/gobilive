"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerChatSignaling = registerChatSignaling;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const chat_model_1 = require("./chat.model");
function verifySocketToken(socket) {
    const token = socket.handshake.auth?.token;
    if (!token)
        return null;
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'super_secret_gobilive_token_key_123!');
        return decoded;
    }
    catch {
        return null;
    }
}
function registerChatSignaling(io) {
    io.on('connection', (socket) => {
        const user = verifySocketToken(socket);
        if (!user)
            return;
        socket.on('join_conversation', async (data) => {
            const conv = await chat_model_1.Conversation.findById(data.conversationId);
            if (!conv || !conv.participants.map(String).includes(user.id))
                return;
            socket.join(`chat_${data.conversationId}`);
        });
        socket.on('leave_conversation', (data) => {
            socket.leave(`chat_${data.conversationId}`);
        });
        socket.on('chat_message', async (data) => {
            const conv = await chat_model_1.Conversation.findById(data.conversationId);
            if (!conv || data.senderId !== user.id)
                return;
            const message = await chat_model_1.Message.create({
                conversationId: data.conversationId,
                senderId: user.id,
                senderUsername: data.senderUsername,
                text: data.text,
                status: 'sent',
            });
            conv.lastMessage = data.text;
            conv.lastMessageAt = new Date();
            await conv.save();
            io.to(`chat_${data.conversationId}`).emit('chat_message_received', {
                ...message.toObject(),
                conversationId: data.conversationId,
            });
        });
        socket.on('chat_typing', (data) => {
            socket.to(`chat_${data.conversationId}`).emit('chat_typing', data);
        });
        socket.on('chat_read', async (data) => {
            await chat_model_1.Message.updateMany({
                conversationId: data.conversationId,
                senderId: { $ne: user.id },
                status: { $ne: 'read' },
            }, { status: 'read' });
            io.to(`chat_${data.conversationId}`).emit('chat_messages_read', {
                conversationId: data.conversationId,
                readerId: user.id,
            });
        });
    });
    console.log('💬 Chat signaling registered');
}
