"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTicketStatus = exports.adminReply = exports.getTicket = exports.listTickets = exports.sendUserMessage = exports.getOrCreateTicket = void 0;
const support_ticket_model_1 = require("./support-ticket.model");
const user_model_1 = require("../auth/user.model");
// ── User: get or create their ticket ─────────────────────────────────────────
const getOrCreateTicket = async (req, res) => {
    try {
        const user = await user_model_1.User.findById(req.user.id).select('username profilePic').lean();
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
        let ticket = await support_ticket_model_1.SupportTicket.findOne({ userId: req.user.id });
        if (!ticket) {
            ticket = await support_ticket_model_1.SupportTicket.create({
                userId: req.user.id,
                userName: user.username,
                userProfilePic: user.profilePic || '',
            });
        }
        res.json({ success: true, ticket });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getOrCreateTicket = getOrCreateTicket;
// ── User: send a message ──────────────────────────────────────────────────────
const sendUserMessage = async (req, res) => {
    try {
        const { text, attachmentUrl } = req.body;
        if (!text?.trim()) {
            res.status(400).json({ success: false, message: 'text is required' });
            return;
        }
        const user = await user_model_1.User.findById(req.user.id).select('username').lean();
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
        const ticket = await support_ticket_model_1.SupportTicket.findOneAndUpdate({ userId: req.user.id }, {
            $push: { messages: { senderId: req.user.id, senderRole: 'user', senderName: user.username, text: text.trim(), attachmentUrl, createdAt: new Date() } },
            $set: { lastMessageAt: new Date(), status: 'open' },
            $setOnInsert: { userName: user.username, userProfilePic: '' },
        }, { new: true, upsert: true });
        res.json({ success: true, ticket });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.sendUserMessage = sendUserMessage;
// ── Admin: list all tickets ───────────────────────────────────────────────────
const listTickets = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page || '1'));
        const limit = Math.min(50, parseInt(req.query.limit || '20'));
        const status = req.query.status;
        const filter = {};
        if (status && ['open', 'resolved', 'closed'].includes(status))
            filter.status = status;
        const [tickets, total] = await Promise.all([
            support_ticket_model_1.SupportTicket.find(filter).sort({ lastMessageAt: -1 }).skip((page - 1) * limit).limit(limit).select('-messages').lean(),
            support_ticket_model_1.SupportTicket.countDocuments(filter),
        ]);
        res.json({ success: true, tickets, total, page, pages: Math.ceil(total / limit) });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.listTickets = listTickets;
// ── Admin: get single ticket ──────────────────────────────────────────────────
const getTicket = async (req, res) => {
    try {
        const ticket = await support_ticket_model_1.SupportTicket.findById(req.params.id).lean();
        if (!ticket) {
            res.status(404).json({ success: false, message: 'Not found' });
            return;
        }
        res.json({ success: true, ticket });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getTicket = getTicket;
// ── Admin: reply to ticket ────────────────────────────────────────────────────
const adminReply = async (req, res) => {
    try {
        const { text, attachmentUrl } = req.body;
        const adminUser = req.adminUser;
        if (!text?.trim()) {
            res.status(400).json({ success: false, message: 'text is required' });
            return;
        }
        const ticket = await support_ticket_model_1.SupportTicket.findByIdAndUpdate(req.params.id, {
            $push: { messages: { senderId: adminUser.id, senderRole: adminUser.role, senderName: adminUser.username || 'Support', text: text.trim(), attachmentUrl, createdAt: new Date() } },
            $set: { lastMessageAt: new Date() },
        }, { new: true });
        if (!ticket) {
            res.status(404).json({ success: false, message: 'Not found' });
            return;
        }
        res.json({ success: true, ticket });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.adminReply = adminReply;
// ── Admin: update status ──────────────────────────────────────────────────────
const updateTicketStatus = async (req, res) => {
    try {
        const { status } = req.body;
        if (!['open', 'resolved', 'closed'].includes(status)) {
            res.status(400).json({ success: false, message: 'Invalid status' });
            return;
        }
        const ticket = await support_ticket_model_1.SupportTicket.findByIdAndUpdate(req.params.id, { status }, { new: true });
        if (!ticket) {
            res.status(404).json({ success: false, message: 'Not found' });
            return;
        }
        res.json({ success: true, ticket });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.updateTicketStatus = updateTicketStatus;
exports.default = {};
