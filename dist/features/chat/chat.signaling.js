"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerChatSignaling = registerChatSignaling;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const chat_model_1 = require("./chat.model");
const cache_service_1 = require("../../core/services/cache.service");
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
            // Cache conversation participant check for 60 seconds to avoid
            // a DB lookup on every join (room rejoins after reconnect are common)
            const cacheKey = `conv:${data.conversationId}:participants`;
            let participants = cache_service_1.AppCache.get(cacheKey);
            if (!participants) {
                const conv = await chat_model_1.Conversation.findById(data.conversationId)
                    .select('participants').lean();
                if (!conv)
                    return;
                participants = conv.participants.map(String);
                cache_service_1.AppCache.set(cacheKey, participants, 60);
            }
            if (!participants.includes(user.id))
                return;
            socket.join(`chat_${data.conversationId}`);
        });
        socket.on('leave_conversation', (data) => {
            socket.leave(`chat_${data.conversationId}`);
        });
        socket.on('chat_message', async (data) => {
            // Validate participant from cache first, fall back to DB
            const cacheKey = `conv:${data.conversationId}:participants`;
            let participants = cache_service_1.AppCache.get(cacheKey);
            if (!participants) {
                const conv = await chat_model_1.Conversation.findById(data.conversationId)
                    .select('participants').lean();
                if (!conv)
                    return;
                participants = conv.participants.map(String);
                cache_service_1.AppCache.set(cacheKey, participants, 60);
            }
            if (!participants.includes(user.id))
                return;
            if (data.senderId !== user.id)
                return;
            const message = await chat_model_1.Message.create({
                conversationId: data.conversationId,
                senderId: user.id,
                senderUsername: data.senderUsername,
                text: data.text,
                status: 'sent',
            });
            // Update conversation lastMessage without re-fetching the whole document
            await chat_model_1.Conversation.updateOne({ _id: data.conversationId }, { $set: { lastMessage: data.text, lastMessageAt: new Date() } });
            // Invalidate cached participants on message (in case conv was modified)
            // Actually participants don't change on message, so keep cache intact
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
