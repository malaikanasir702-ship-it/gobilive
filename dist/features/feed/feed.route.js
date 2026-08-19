"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const feed_controller_1 = require("./feed.controller");
const feed_download_controller_1 = require("./feed.download.controller");
const auth_middleware_1 = require("../../core/middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Static routes FIRST (before /:id to avoid conflicts)
router.get('/public', feed_controller_1.getPublicFeed);
router.get('/archived', auth_middleware_1.authenticateJWT, feed_controller_1.getArchivedPosts);
router.get('/saved', auth_middleware_1.authenticateJWT, feed_controller_1.getSavedPosts);
// Feed CRUD
router.get('/', auth_middleware_1.authenticateJWT, feed_controller_1.getFeed);
router.post('/', auth_middleware_1.authenticateJWT, feed_controller_1.createPost);
// Per-post actions
router.delete('/:id', auth_middleware_1.authenticateJWT, feed_controller_1.deletePost);
router.patch('/:id', auth_middleware_1.authenticateJWT, feed_controller_1.editPost);
router.patch('/:id/archive', auth_middleware_1.authenticateJWT, feed_controller_1.archivePost);
router.patch('/:id/restore', auth_middleware_1.authenticateJWT, feed_controller_1.restorePost);
router.post('/:id/like', auth_middleware_1.authenticateJWT, feed_controller_1.likePost);
router.post('/:id/save', auth_middleware_1.authenticateJWT, feed_controller_1.savePost);
router.post('/:id/share', auth_middleware_1.authenticateJWT, feed_controller_1.sharePost);
router.post('/:id/view', auth_middleware_1.authenticateJWT, feed_controller_1.viewPost);
router.get('/:id/comments', auth_middleware_1.authenticateJWT, feed_controller_1.getComments);
router.post('/:id/comments', auth_middleware_1.authenticateJWT, feed_controller_1.addComment);
router.post('/:id/report', auth_middleware_1.authenticateJWT, feed_controller_1.reportPost);
router.post('/:id/appeal', auth_middleware_1.authenticateJWT, feed_controller_1.appealPost);
// Watermarked video download — server-side FFmpeg
router.get('/:id/download', auth_middleware_1.authenticateJWT, feed_download_controller_1.downloadWithWatermark);
exports.default = router;
