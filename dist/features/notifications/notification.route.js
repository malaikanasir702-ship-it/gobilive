"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../core/middlewares/auth.middleware");
const notification_controller_1 = require("./notification.controller");
const router = (0, express_1.Router)();
// Existing
router.post('/register-token', auth_middleware_1.authenticateJWT, notification_controller_1.registerToken);
router.post('/unregister-token', auth_middleware_1.authenticateJWT, notification_controller_1.unregisterToken);
router.post('/test', auth_middleware_1.authenticateJWT, notification_controller_1.sendTestNotification);
// New: notification history + mark-read
router.get('/', auth_middleware_1.authenticateJWT, notification_controller_1.getNotifications);
router.patch('/read-all', auth_middleware_1.authenticateJWT, notification_controller_1.markAllRead);
router.patch('/:id/read', auth_middleware_1.authenticateJWT, notification_controller_1.markOneRead);
exports.default = router;
