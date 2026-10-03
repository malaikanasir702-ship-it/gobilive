import { Router } from 'express';
import { authenticateJWT } from '../../core/middlewares/auth.middleware';
import {
  getActivities,
  getUnreadCount,
  markAllRead,
  markOneRead,
  recordProfileView,
  getPrivacySettings,
  updatePrivacySettings,
} from './activity.controller';

const router = Router();

// Feed
router.get('/',               authenticateJWT as any, getActivities    as any);
router.get('/unread-count',   authenticateJWT as any, getUnreadCount   as any);

// Mark read
router.patch('/read-all',     authenticateJWT as any, markAllRead      as any);
router.patch('/:id/read',     authenticateJWT as any, markOneRead      as any);

// Profile view recording
router.post('/profile-view/:userId', authenticateJWT as any, recordProfileView as any);

// Privacy settings
router.get('/privacy',        authenticateJWT as any, getPrivacySettings      as any);
router.patch('/privacy',      authenticateJWT as any, updatePrivacySettings   as any);

export default router;
