import { Router } from 'express';
import {
  createStory,
  getMyStories,
  getUserStories,
  getStoriesFeed,
  viewStory,
  getStoryViewers,
  deleteStory,
  getStoryPrivacy,
  updateStoryPrivacy,
} from './story.controller';
import { authenticateJWT } from '../../core/middlewares/auth.middleware';

const router = Router();

// Static routes FIRST (before /:id to avoid route conflicts)
router.get('/mine',           authenticateJWT as any, getMyStories      as any);
router.get('/feed',           authenticateJWT as any, getStoriesFeed    as any);
router.get('/privacy',        authenticateJWT as any, getStoryPrivacy   as any);
router.patch('/privacy',      authenticateJWT as any, updateStoryPrivacy as any);

// Per-user stories (with privacy filter)
router.get('/user/:userId',   authenticateJWT as any, getUserStories    as any);

// Per-story actions
router.post('/:id/view',      authenticateJWT as any, viewStory         as any);
router.get('/:id/viewers',    authenticateJWT as any, getStoryViewers   as any);
router.delete('/:id',         authenticateJWT as any, deleteStory       as any);

// Create story (must be after static routes)
router.post('/',              authenticateJWT as any, createStory       as any);

export default router;
