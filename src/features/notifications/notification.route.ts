import { Router } from 'express';
import { authenticateJWT } from '../../core/middlewares/auth.middleware';
import {
  registerToken,
  sendTestNotification,
  unregisterToken,
  getNotifications,
  markAllRead,
  markOneRead,
} from './notification.controller';

const router = Router();

// Existing
router.post('/register-token',   authenticateJWT as any, registerToken as any);
router.post('/unregister-token', authenticateJWT as any, unregisterToken as any);
router.post('/test',             authenticateJWT as any, sendTestNotification as any);

// New: notification history + mark-read
router.get('/',                  authenticateJWT as any, getNotifications as any);
router.patch('/read-all',        authenticateJWT as any, markAllRead as any);
router.patch('/:id/read',        authenticateJWT as any, markOneRead as any);

export default router;
