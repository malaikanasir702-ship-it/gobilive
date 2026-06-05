import { Router } from 'express';
import {
  listSuperAdmins,
  approveSuperAdmin,
  rejectSuperAdmin,
  blockSuperAdmin,
  unblockSuperAdmin,
  fireSuperAdmin,
  transferAgencies,
} from './super-admins.controller';
import { authenticateAdminPanel, requireRoles } from '../../core/middlewares/rbac.middleware';

const router = Router();
router.use(authenticateAdminPanel as any);

const COMPANY_ONLY = requireRoles('company_admin') as any;

router.get('/', COMPANY_ONLY, listSuperAdmins as any);
router.post('/:id/approve', COMPANY_ONLY, approveSuperAdmin as any);
router.post('/:id/reject', COMPANY_ONLY, rejectSuperAdmin as any);
router.post('/:id/block', COMPANY_ONLY, blockSuperAdmin as any);
router.post('/:id/unblock', COMPANY_ONLY, unblockSuperAdmin as any);
router.post('/:id/fire', COMPANY_ONLY, fireSuperAdmin as any);
router.post('/:fromSuperAdminId/transfer-agencies', COMPANY_ONLY, transferAgencies as any);

export default router;
