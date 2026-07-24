"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSupportChats = listSupportChats;
exports.getSupportChat = getSupportChat;
exports.replyToSupportChat = replyToSupportChat;
exports.closeSupportChat = closeSupportChat;
const support_chat_model_1 = require("../support/support-chat.model");
const activity_log_service_1 = require("../activity-log/activity-log.service");
async function listSupportChats(req, res) {
    try {
        const { agencyId, participantId, page = 1, limit = 20 } = req.query;
        const adminUser = req.adminUser;
        const filter = {};
        // Agency sees only their own chats; admins see all
        if (adminUser?.role === 'agency' || adminUser?.role === 'sub_agency') {
            filter.agencyId = adminUser.id;
        }
        else {
            if (agencyId)
                filter.agencyId = agencyId;
        }
        if (participantId)
            filter.participantId = participantId;
        const total = await support_chat_model_1.SupportChat.countDocuments(filter);
        const data = await support_chat_model_1.SupportChat.find(filter)
            .sort({ lastMessageAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit))
            .select('-messages') // exclude messages for list view (load on detail)
            .lean();
        res.json({ success: true, data, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function getSupportChat(req, res) {
    try {
        const { id } = req.params;
        const adminUser = req.adminUser;
        const chat = await support_chat_model_1.SupportChat.findById(id).lean();
        if (!chat)
            return res.status(404).json({ success: false, message: 'Not found' });
        // Agency can only view their own chats
        if ((adminUser?.role === 'agency' || adminUser?.role === 'sub_agency') &&
            chat.agencyId.toString() !== adminUser.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
        res.json({ success: true, data: chat });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function replyToSupportChat(req, res) {
    try {
        const id = String(req.params.id);
        const { message, attachmentUrl } = req.body;
        const adminUser = req.adminUser;
        if (!message)
            return res.status(400).json({ success: false, message: 'message is required' });
        const chat = await support_chat_model_1.SupportChat.findById(id);
        if (!chat)
            return res.status(404).json({ success: false, message: 'Not found' });
        // Only agency (owner) can reply; admins have view-only access
        if (adminUser?.role !== 'agency' && adminUser?.role !== 'sub_agency') {
            return res.status(403).json({ success: false, message: 'Only agency admins can reply to support chats' });
        }
        chat.messages.push({
            senderId: adminUser.id,
            senderRole: adminUser.role,
            message,
            attachmentUrl,
            createdAt: new Date(),
        });
        chat.lastMessageAt = new Date();
        await chat.save();
        await (0, activity_log_service_1.logActivity)({
            actorId: adminUser.id, actorRole: adminUser.role,
            actionType: 'support_reply', targetEntityType: 'SupportChat', targetEntityId: id,
            description: `Agency replied to support chat: "${message.slice(0, 80)}"`,
        });
        res.json({ success: true, data: chat });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function closeSupportChat(req, res) {
    try {
        const id = String(req.params.id);
        const adminUser = req.adminUser;
        const chat = await support_chat_model_1.SupportChat.findByIdAndUpdate(id, { $set: { closedAt: new Date() } }, { new: true });
        if (!chat)
            return res.status(404).json({ success: false, message: 'Not found' });
        await (0, activity_log_service_1.logActivity)({
            actorId: adminUser?.id, actorRole: adminUser?.role || 'agency',
            actionType: 'close_support', targetEntityType: 'SupportChat', targetEntityId: id,
            description: 'Closed support chat',
        });
        res.json({ success: true, data: chat });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
exports.default = {};
