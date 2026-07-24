"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const story_controller_1 = require("./story.controller");
const auth_middleware_1 = require("../../core/middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Static routes FIRST (before /:id to avoid route conflicts)
router.get('/mine', auth_middleware_1.authenticateJWT, story_controller_1.getMyStories);
router.get('/feed', auth_middleware_1.authenticateJWT, story_controller_1.getStoriesFeed);
router.get('/privacy', auth_middleware_1.authenticateJWT, story_controller_1.getStoryPrivacy);
router.patch('/privacy', auth_middleware_1.authenticateJWT, story_controller_1.updateStoryPrivacy);
// Per-user stories (with privacy filter)
router.get('/user/:userId', auth_middleware_1.authenticateJWT, story_controller_1.getUserStories);
// Per-story actions
router.post('/:id/view', auth_middleware_1.authenticateJWT, story_controller_1.viewStory);
router.get('/:id/viewers', auth_middleware_1.authenticateJWT, story_controller_1.getStoryViewers);
router.delete('/:id', auth_middleware_1.authenticateJWT, story_controller_1.deleteStory);
// Create story (must be after static routes)
router.post('/', auth_middleware_1.authenticateJWT, story_controller_1.createStory);
exports.default = router;
