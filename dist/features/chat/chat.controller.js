"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteConversation = exports.markMessagesRead = exports.unsendMessage = exports.sendMessage = exports.getMessages = exports.startConversation = exports.getConversations = void 0;
const chat_model_1 = require("./chat.model");
const user_model_1 = require("../auth/user.model");
const notification_service_1 = require("../notifications/notification.service");
const getConversations = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const conversations = await chat_model_1.Conversation.find({
            participants: req.user.id,
        })
            .sort({ lastMessageAt: -1 })
            .populate('participants', 'username profilePic')
            .lean();
        // Attach unread count for each conversation:
        // count messages NOT sent by the current user that are not yet 'read'.
        const conversationsWithUnread = await Promise.all(conversations.map(async (conv) => {
            const unreadCount = await chat_model_1.Message.countDocuments({
                conversationId: conv._id,
                senderId: { $ne: req.user.id },
                status: { $ne: 'read' },
                isUnsent: false,
            });
            return { ...conv, unreadCount };
        }));
        res.status(200).json({ success: true, conversations: conversationsWithUnread });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getConversations = getConversations;
const startConversation = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const { userId } = req.body;
        const other = await user_model_1.User.findById(userId);
        if (!other) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        let conversation = await chat_model_1.Conversation.findOne({
            participants: { $all: [req.user.id, userId] },
        });
        if (!conversation) {
            const me = await user_model_1.User.findById(req.user.id);
            conversation = await chat_model_1.Conversation.create({
                participants: [req.user.id, userId],
                participantUsernames: [me?.username ?? 'User', other.username],
            });
        }
        const populatedConversation = await chat_model_1.Conversation.findById(conversation.id)
            .populate('participants', 'username profilePic')
            .lean();
        res.status(200).json({ success: true, conversation: populatedConversation || conversation });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.startConversation = startConversation;
const getMessages = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const conversation = await chat_model_1.Conversation.findById(req.params.conversationId);
        if (!conversation || !conversation.participants.map(String).includes(req.user.id)) {
            res.status(403).json({ success: false, message: 'Access denied.' });
            return;
        }
        const messages = await chat_model_1.Message.find({
            conversationId: conversation.id,
            isUnsent: false,
        })
            .sort({ createdAt: 1 })
            .limit(200)
            .lean();
        res.status(200).json({ success: true, messages });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getMessages = getMessages;
const sendMessage = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const { conversationId, text, mediaUrl, mediaType } = req.body;
        const conversation = await chat_model_1.Conversation.findById(conversationId);
        if (!conversation || !conversation.participants.map(String).includes(req.user.id)) {
            res.status(403).json({ success: false, message: 'Access denied.' });
            return;
        }
        const me = await user_model_1.User.findById(req.user.id);
        const message = await chat_model_1.Message.create({
            conversationId,
            senderId: req.user.id,
            senderUsername: me?.username ?? 'User',
            text: text || '',
            mediaUrl,
            mediaType,
            status: 'sent',
        });
        conversation.lastMessage = text || (mediaType ? `[${mediaType}]` : '');
        conversation.lastMessageAt = new Date();
        await conversation.save();
        const userId = req.user.id;
        const recipientId = conversation.participants
            .map(String)
            .find((id) => id !== userId);
        if (recipientId) {
            const recipient = await user_model_1.User.findById(recipientId);
            if (recipient?.notificationPrefs?.messages !== false) {
                (0, notification_service_1.sendToUser)(recipientId, notification_service_1.NotificationTriggers.newMessage(me?.username ?? 'Someone', text || 'New message')).catch(() => { });
            }
        }
        res.status(201).json({ success: true, message });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.sendMessage = sendMessage;
const unsendMessage = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const msg = await chat_model_1.Message.findById(req.params.messageId);
        if (!msg || msg.senderId.toString() !== req.user.id) {
            res.status(403).json({ success: false, message: 'Cannot unsend this message.' });
            return;
        }
        msg.isUnsent = true;
        msg.text = '';
        await msg.save();
        res.status(200).json({ success: true, message: 'Message unsent.' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.unsendMessage = unsendMessage;
const markMessagesRead = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        await chat_model_1.Message.updateMany({
            conversationId: req.params.conversationId,
            senderId: { $ne: req.user.id },
            status: { $ne: 'read' },
        }, { status: 'read' });
        res.status(200).json({ success: true });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.markMessagesRead = markMessagesRead;
const deleteConversation = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const conversation = await chat_model_1.Conversation.findById(req.params.conversationId);
        if (!conversation) {
            res.status(404).json({ success: false, message: 'Conversation not found.' });
            return;
        }
        // Only a participant can delete the conversation.
        if (!conversation.participants.map(String).includes(req.user.id)) {
            res.status(403).json({ success: false, message: 'Access denied.' });
            return;
        }
        // Delete all messages in the conversation, then the conversation itself.
        await chat_model_1.Message.deleteMany({ conversationId: conversation._id });
        await conversation.deleteOne();
        res.status(200).json({ success: true, message: 'Conversation deleted.' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.deleteConversation = deleteConversation;
