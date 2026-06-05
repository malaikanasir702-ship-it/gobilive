import { Router } from 'express';
import {
  listUsers,
  getUserProfile,
  blockUser,
  unblockUser,
  suspendUser,
} from './users-admin.controller';
import { authenticateAdminPanel, requireRoles } from '../../core/middlewares/rbac.middleware';

const router = Router();

router.use(authenticateAdminPanel as any);

const GUARD = requireRoles('company_admin', 'super_admin', 'sub_admin', 'agency', 'sub_agency') as any;

router.get('/', GUARD, listUsers as any);
router.get('/:id', GUARD, getUserProfile as any);
router.post('/:id/block', GUARD, blockUser as any);
router.post('/:id/unblock', GUARD, unblockUser as any);
router.post('/:id/suspend', GUARD, suspendUser as any);

export default router;
