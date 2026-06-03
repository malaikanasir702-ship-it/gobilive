import { Router } from 'express';
import { authenticateJWT } from '../../core/middlewares/auth.middleware';
import {
  joinMatchQueue,
  leaveMatchQueue,
  endVideoCall,
  getCallToken,
} from './video-call.controller';

const router = Router();

router.post('/match', authenticateJWT as any, joinMatchQueue as any);
router.delete('/match', authenticateJWT as any, leaveMatchQueue as any);
router.post('/end', authenticateJWT as any, endVideoCall as any);
router.get('/token/:channelName', authenticateJWT as any, getCallToken as any);

export default router;
