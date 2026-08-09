import { Router } from 'express';
import {
  listReels,
  deleteReelByAdmin,
  handleAppealDecision,
} from './reels-admin.controller';
import { authenticateAdminPanel, requireRoles } from '../../core/middlewares/rbac.middleware';

const router = Router();

router.use(authenticateAdminPanel as any);

const GUARD = requireRoles('company_admin', 'super_admin', 'sub_admin') as any;

router.get('/',                    GUARD, listReels as any);
router.post('/:id/delete',         GUARD, deleteReelByAdmin as any);
router.delete('/:id',              GUARD, deleteReelByAdmin as any);
router.post('/:id/appeal-decision', GUARD, handleAppealDecision as any);

export default router;
