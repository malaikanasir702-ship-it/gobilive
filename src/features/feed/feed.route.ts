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
} from './feed.controller';
import { authenticateJWT } from '../../core/middlewares/auth.middleware';

const router = Router();

// Static routes FIRST (before /:id to avoid conflicts)
router.get('/archived',      authenticateJWT as any, getArchivedPosts as any);
router.get('/saved',         authenticateJWT as any, getSavedPosts    as any);

// Feed CRUD
router.get('/',              authenticateJWT as any, getFeed          as any);
router.post('/',             authenticateJWT as any, createPost       as any);

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

export default router;
