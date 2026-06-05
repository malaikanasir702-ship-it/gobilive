import { Router } from 'express';
import {
  listSubAdmins,
  approveSubAdmin,
  rejectSubAdmin,
  blockSubAdmin,
  unblockSubAdmin,
  getSubAdminDetail,
} from './sub-admins.controller';
import { authenticateAdminPanel, requireRoles } from '../../core/middlewares/rbac.middleware';

const router = Router();
router.use(authenticateAdminPanel as any);

const GUARD = requireRoles('company_admin', 'super_admin') as any;

router.get('/', GUARD, listSubAdmins as any);
router.get('/:id', GUARD, getSubAdminDetail as any);
router.post('/:id/approve', GUARD, approveSubAdmin as any);
router.post('/:id/reject', GUARD, rejectSubAdmin as any);
router.post('/:id/block', GUARD, blockSubAdmin as any);
router.post('/:id/unblock', GUARD, unblockSubAdmin as any);

export default router;
