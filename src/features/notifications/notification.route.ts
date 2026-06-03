import { Router } from 'express';
import { authenticateJWT } from '../../core/middlewares/auth.middleware';
import {
  registerToken,
  sendTestNotification,
  unregisterToken,
} from './notification.controller';

const router = Router();

router.post('/register-token', authenticateJWT as any, registerToken as any);
router.post('/unregister-token', authenticateJWT as any, unregisterToken as any);
router.post('/test', authenticateJWT as any, sendTestNotification as any);

export default router;
