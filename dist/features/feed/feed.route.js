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
router.get('/promote/packages', auth_middleware_1.authenticateJWT, feed_controller_1.getPromotionPackages);
router.get('/promotion-packages', auth_middleware_1.authenticateJWT, feed_controller_1.getPromotionPackages);
// Company Admin Promotion Management
router.get('/admin/promotions/packages', auth_middleware_1.authenticateJWT, feed_controller_1.getAdminPromotionPackages);
router.post('/admin/promotions/packages', auth_middleware_1.authenticateJWT, feed_controller_1.createAdminPromotionPackage);
router.put('/admin/promotions/packages/:id', auth_middleware_1.authenticateJWT, feed_controller_1.updateAdminPromotionPackage);
router.delete('/admin/promotions/packages/:id', auth_middleware_1.authenticateJWT, feed_controller_1.deleteAdminPromotionPackage);
router.get('/admin/promotions/campaigns', auth_middleware_1.authenticateJWT, feed_controller_1.getAdminPromotionCampaigns);
router.patch('/admin/promotions/campaigns/:id/status', auth_middleware_1.authenticateJWT, feed_controller_1.updateAdminCampaignStatus);
router.get('/admin/promotions/stats', auth_middleware_1.authenticateJWT, feed_controller_1.getAdminPromotionStats);
// Feed CRUD
router.get('/', auth_middleware_1.authenticateJWT, feed_controller_1.getFeed);
router.post('/', auth_middleware_1.authenticateJWT, feed_controller_1.createPost);
// Per-post actions
router.post('/:id/not-interested', auth_middleware_1.authenticateJWT, feed_controller_1.markNotInterested);
router.post('/:id/promote', auth_middleware_1.authenticateJWT, feed_controller_1.promotePost);
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
router.post('/:id/repost', auth_middleware_1.authenticateJWT, feed_controller_1.repostPost);
router.post('/:id/pin', auth_middleware_1.authenticateJWT, feed_controller_1.pinPost);
router.delete('/:id/pin', auth_middleware_1.authenticateJWT, feed_controller_1.unpinPost);
router.post('/:id/unpin', auth_middleware_1.authenticateJWT, feed_controller_1.unpinPost);
// Comment reactions & replies
router.post('/:id/comments/:commentId/react', auth_middleware_1.authenticateJWT, feed_controller_1.reactToComment);
router.post('/:id/comments/:commentId/replies', auth_middleware_1.authenticateJWT, feed_controller_1.replyToComment);
router.get('/:id/comments/:commentId/replies', auth_middleware_1.authenticateJWT, feed_controller_1.getReplies);
// Reposts with notes
router.get('/:id/reposts', auth_middleware_1.authenticateJWT, feed_controller_1.getReposts);
router.delete('/:id/reposts/:repostId', auth_middleware_1.authenticateJWT, feed_controller_1.deleteRepost);
// Watermarked video download — server-side FFmpeg
router.get('/:id/download', auth_middleware_1.authenticateJWT, feed_download_controller_1.downloadWithWatermark);
exports.default = router;
