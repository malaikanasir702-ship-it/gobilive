import { Router } from 'express';
import { authenticateJWT } from '../../core/middlewares/auth.middleware';
import {
  createRoom,
  endRoom,
  getActiveRooms,
  getAgoraCredentials,
  kickViewer,
  getSessionSummary,
  findPkOpponent,
  getMySessions,
  likeRoom,
  saveRoom,
  hideCreator,
  reportRoom,
} from './live.controller';

const router = Router();

router.get('/rooms', authenticateJWT as any, getActiveRooms as any);
router.get('/my-sessions', authenticateJWT as any, getMySessions as any);
router.post('/rooms', authenticateJWT as any, createRoom as any);
router.get('/rooms/:channelName/agora', authenticateJWT as any, getAgoraCredentials as any);
router.post('/rooms/:channelName/end', authenticateJWT as any, endRoom as any);
router.post('/rooms/:channelName/pk/match', authenticateJWT as any, findPkOpponent as any);
router.post('/rooms/:channelName/kick', authenticateJWT as any, kickViewer as any);
router.get('/rooms/:channelName/summary', getSessionSummary as any);

// Like, save, hide, report routes
router.post('/rooms/:channelName/like', authenticateJWT as any, likeRoom as any);
router.post('/rooms/:channelName/save', authenticateJWT as any, saveRoom as any);
router.post('/creators/hide', authenticateJWT as any, hideCreator as any);
router.post('/rooms/:channelName/report', authenticateJWT as any, reportRoom as any);

export default router;

