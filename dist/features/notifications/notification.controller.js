"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.markOneRead = exports.markAllRead = exports.getNotifications = exports.sendTestNotification = exports.unregisterToken = exports.registerToken = void 0;
const notification_service_1 = require("./notification.service");
const notification_model_1 = __importDefault(require("./notification.model"));
const registerToken = async (req, res) => {
    try {
        const { token, platform } = req.body;
        if (!token) {
            res.status(400).json({ success: false, message: 'FCM token is required.' });
            return;
        }
        const result = await (0, notification_service_1.registerFcmToken)(req.user.id, token, platform);
        res.status(200).json({ success: true, ...result });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};
exports.registerToken = registerToken;
const unregisterToken = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            res.status(400).json({ success: false, message: 'FCM token is required.' });
            return;
        }
        await (0, notification_service_1.removeFcmToken)(req.user.id, token);
        res.status(200).json({ success: true, message: 'Token removed.' });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};
exports.unregisterToken = unregisterToken;
const sendTestNotification = async (req, res) => {
    try {
        const { title, body } = req.body;
        const result = await (0, notification_service_1.sendToUser)(req.user.id, {
            title: title || 'Gobilive Test',
            body: body || 'Push notifications are working!',
            data: { type: 'test' },
        });
        res.status(200).json({ success: true, result });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};
exports.sendTestNotification = sendTestNotification;
// GET /notifications — paginated history for current user
const getNotifications = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 30;
        const skip = (page - 1) * limit;
        const notifications = await notification_model_1.default.find({ recipientId: req.user.id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
        const unreadCount = await notification_model_1.default.countDocuments({
            recipientId: req.user.id,
            isRead: false,
        });
        res.status(200).json({ success: true, notifications, unreadCount });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};
exports.getNotifications = getNotifications;
// PATCH /notifications/read-all — mark all as read
const markAllRead = async (req, res) => {
    try {
        await notification_model_1.default.updateMany({ recipientId: req.user.id, isRead: false }, { $set: { isRead: true } });
        res.status(200).json({ success: true });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};
exports.markAllRead = markAllRead;
// PATCH /notifications/:id/read — mark single notification as read
const markOneRead = async (req, res) => {
    try {
        await notification_model_1.default.findOneAndUpdate({ _id: req.params.id, recipientId: req.user.id }, { $set: { isRead: true } });
        res.status(200).json({ success: true });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};
exports.markOneRead = markOneRead;
