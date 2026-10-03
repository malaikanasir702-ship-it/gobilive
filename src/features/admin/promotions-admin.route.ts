import { Router } from 'express';
import {
  getAdminPromotionPackages,
  createAdminPromotionPackage,
  updateAdminPromotionPackage,
  deleteAdminPromotionPackage,
  getAdminPromotionCampaigns,
  updateAdminCampaignStatus,
  getAdminPromotionStats,
} from '../feed/feed.controller';
import { authenticateAdminPanel, requireRoles } from '../../core/middlewares/rbac.middleware';

const router = Router();

router.use(authenticateAdminPanel as any);

const GUARD = requireRoles('company_admin') as any;

router.get('/stats',                    GUARD, getAdminPromotionStats as any);
router.get('/packages',                 GUARD, getAdminPromotionPackages as any);
router.post('/packages',                GUARD, createAdminPromotionPackage as any);
router.put('/packages/:id',             GUARD, updateAdminPromotionPackage as any);
router.delete('/packages/:id',          GUARD, deleteAdminPromotionPackage as any);
router.get('/campaigns',                GUARD, getAdminPromotionCampaigns as any);
router.patch('/campaigns/:id/status',   GUARD, updateAdminCampaignStatus as any);

export default router;
