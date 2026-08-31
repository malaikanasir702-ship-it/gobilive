import { Router } from 'express';
import { authenticateJWT } from '../../core/middlewares/auth.middleware';
import {
  getReferralInfo,
  applyReferralCode,
  claimAdReward,
  getAdRewardStatus,
  getReferralStats,
} from './referral.controller';

const router = Router();

router.get('/info', authenticateJWT as any, getReferralInfo as any);
router.get('/ad-status', authenticateJWT as any, getAdRewardStatus as any);
router.get('/stats', authenticateJWT as any, getReferralStats as any);
router.post('/apply', authenticateJWT as any, applyReferralCode as any);
router.post('/ad-reward', authenticateJWT as any, claimAdReward as any);

export default router;
