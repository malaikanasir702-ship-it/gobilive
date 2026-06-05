import { Router } from 'express';
import {
  listHosts,
  getHostProfile,
  blockHost,
  unblockHost,
  approveHost,
  disapproveHost,
  transferHostAgency,
} from './hosts-admin.controller';
import { authenticateAdminPanel, requireRoles } from '../../core/middlewares/rbac.middleware';

const router = Router();
router.use(authenticateAdminPanel as any);

const GUARD = requireRoles('company_admin', 'super_admin', 'sub_admin', 'agency', 'sub_agency') as any;

router.get('/', GUARD, listHosts as any);
router.get('/:id', GUARD, getHostProfile as any);
router.post('/:id/block', GUARD, blockHost as any);
router.post('/:id/unblock', GUARD, unblockHost as any);
router.post('/:id/approve', GUARD, approveHost as any);
router.post('/:id/disapprove', GUARD, disapproveHost as any);
router.post('/:id/transfer-agency', GUARD, transferHostAgency as any);

export default router;
