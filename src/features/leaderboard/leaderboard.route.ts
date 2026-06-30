import { Router } from 'express';
import { getRichest, getTopHosts, getTopGifters } from './leaderboard.controller';
import { authenticateJWT } from '../../core/middlewares/auth.middleware';

const router = Router();

router.get('/richest', authenticateJWT as any, getRichest as any);
router.get('/hosts', authenticateJWT as any, getTopHosts as any);
router.get('/gifters', authenticateJWT as any, getTopGifters as any);

export default router;
