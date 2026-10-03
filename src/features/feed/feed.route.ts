import { Router } from 'express';
import {
  getFeed,
  createPost,
  likePost,
  sharePost,
  viewPost,
  getComments,
  addComment,
  deletePost,
  archivePost,
  restorePost,
  editPost,
  getArchivedPosts,
  savePost,
  getSavedPosts,
  reportPost,
  appealPost,
  getPublicFeed,
  repostPost,
  pinPost,
  unpinPost,
  reactToComment,
  replyToComment,
  getReplies,
  getReposts,
  deleteRepost,
  markNotInterested,
  getPromotionPackages,
  promotePost,
  getAdminPromotionPackages,
  createAdminPromotionPackage,
  updateAdminPromotionPackage,
  deleteAdminPromotionPackage,
  getAdminPromotionCampaigns,
  updateAdminCampaignStatus,
  getAdminPromotionStats,
} from './feed.controller';
import { downloadWithWatermark } from './feed.download.controller';
import { authenticateJWT } from '../../core/middlewares/auth.middleware';

const router = Router();

// Static routes FIRST (before /:id to avoid conflicts)
router.get('/public',           getPublicFeed        as any);
router.get('/archived',        authenticateJWT as any, getArchivedPosts    as any);
router.get('/saved',           authenticateJWT as any, getSavedPosts       as any);
router.get('/promote/packages', authenticateJWT as any, getPromotionPackages as any);
router.get('/promotion-packages', authenticateJWT as any, getPromotionPackages as any);

// Company Admin Promotion Management
router.get('/admin/promotions/packages',         authenticateJWT as any, getAdminPromotionPackages as any);
router.post('/admin/promotions/packages',        authenticateJWT as any, createAdminPromotionPackage as any);
router.put('/admin/promotions/packages/:id',     authenticateJWT as any, updateAdminPromotionPackage as any);
router.delete('/admin/promotions/packages/:id',  authenticateJWT as any, deleteAdminPromotionPackage as any);
router.get('/admin/promotions/campaigns',        authenticateJWT as any, getAdminPromotionCampaigns as any);
router.patch('/admin/promotions/campaigns/:id/status', authenticateJWT as any, updateAdminCampaignStatus as any);
router.get('/admin/promotions/stats',            authenticateJWT as any, getAdminPromotionStats as any);

// Feed CRUD
router.get('/',                authenticateJWT as any, getFeed             as any);
router.post('/',               authenticateJWT as any, createPost          as any);

// Per-post actions
router.post('/:id/not-interested', authenticateJWT as any, markNotInterested as any);
router.post('/:id/promote',        authenticateJWT as any, promotePost        as any);

// Per-post actions
router.delete('/:id',        authenticateJWT as any, deletePost       as any);
router.patch('/:id',         authenticateJWT as any, editPost         as any);
router.patch('/:id/archive', authenticateJWT as any, archivePost      as any);
router.patch('/:id/restore', authenticateJWT as any, restorePost      as any);
router.post('/:id/like',     authenticateJWT as any, likePost         as any);
router.post('/:id/save',     authenticateJWT as any, savePost         as any);
router.post('/:id/share',    authenticateJWT as any, sharePost        as any);
router.post('/:id/view',     authenticateJWT as any, viewPost         as any);
router.get('/:id/comments',  authenticateJWT as any, getComments      as any);
router.post('/:id/comments', authenticateJWT as any, addComment       as any);
router.post('/:id/report',   authenticateJWT as any, reportPost       as any);
router.post('/:id/appeal',   authenticateJWT as any, appealPost       as any);
router.post('/:id/repost',   authenticateJWT as any, repostPost       as any);
router.post('/:id/pin',      authenticateJWT as any, pinPost          as any);
router.delete('/:id/pin',    authenticateJWT as any, unpinPost        as any);
router.post('/:id/unpin',    authenticateJWT as any, unpinPost        as any);

// Comment reactions & replies
router.post('/:id/comments/:commentId/react',   authenticateJWT as any, reactToComment as any);
router.post('/:id/comments/:commentId/replies', authenticateJWT as any, replyToComment as any);
router.get('/:id/comments/:commentId/replies',  authenticateJWT as any, getReplies     as any);

// Reposts with notes
router.get('/:id/reposts',              authenticateJWT as any, getReposts    as any);
router.delete('/:id/reposts/:repostId', authenticateJWT as any, deleteRepost  as any);

// Watermarked video download — server-side FFmpeg
router.get('/:id/download',  authenticateJWT as any, downloadWithWatermark as any);

export default router;
