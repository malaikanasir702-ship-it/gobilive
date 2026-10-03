"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../core/middlewares/auth.middleware");
const activity_controller_1 = require("./activity.controller");
const router = (0, express_1.Router)();
// Feed
router.get('/', auth_middleware_1.authenticateJWT, activity_controller_1.getActivities);
router.get('/unread-count', auth_middleware_1.authenticateJWT, activity_controller_1.getUnreadCount);
// Mark read
router.patch('/read-all', auth_middleware_1.authenticateJWT, activity_controller_1.markAllRead);
router.patch('/:id/read', auth_middleware_1.authenticateJWT, activity_controller_1.markOneRead);
// Profile view recording
router.post('/profile-view/:userId', auth_middleware_1.authenticateJWT, activity_controller_1.recordProfileView);
// Privacy settings
router.get('/privacy', auth_middleware_1.authenticateJWT, activity_controller_1.getPrivacySettings);
router.patch('/privacy', auth_middleware_1.authenticateJWT, activity_controller_1.updatePrivacySettings);
exports.default = router;
