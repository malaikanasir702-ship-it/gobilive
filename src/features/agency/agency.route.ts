import { Router } from 'express';
import { authenticateJWT } from '../../core/middlewares/auth.middleware';
import { getMyAgency, createAgency, addStreamerToAgency } from './agency.controller';
import { requestPayout, getMyPayouts } from './agency-payout.controller';

const router = Router();

router.get('/mine', authenticateJWT as any, getMyAgency as any);
router.post('/', authenticateJWT as any, createAgency as any);
router.post('/streamers', authenticateJWT as any, addStreamerToAgency as any);
router.post('/payouts/request', authenticateJWT as any, requestPayout as any);
router.get('/payouts/mine', authenticateJWT as any, getMyPayouts as any);

export default router;
