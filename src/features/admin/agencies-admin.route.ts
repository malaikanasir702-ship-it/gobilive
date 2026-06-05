import { Router } from 'express';
import {
  listAgencies,
  getAgencyDetail,
  terminateAgency,
  transferHosts,
  blockAgency,
  unblockAgency,
  approveAgency,
  rejectAgency,
  sendTerminationReason,
  getTop10Agencies,
} from './agencies-admin.controller';
import { authenticateAdminPanel, requireRoles } from '../../core/middlewares/rbac.middleware';

const router = Router();
router.use(authenticateAdminPanel as any);

const GUARD = requireRoles('company_admin', 'super_admin', 'sub_admin', 'agency', 'sub_agency') as any;
const SUPER_ADMIN = requireRoles('super_admin') as any;
const COMPANY_OR_SUPER = requireRoles('company_admin', 'super_admin') as any;

router.get('/', GUARD, listAgencies as any);
router.get('/top10', GUARD, getTop10Agencies as any);
router.get('/:id', GUARD, getAgencyDetail as any);
router.post('/:id/terminate', COMPANY_OR_SUPER, terminateAgency as any);
router.post('/:id/transfer-hosts', COMPANY_OR_SUPER, transferHosts as any);
router.post('/:id/block', COMPANY_OR_SUPER, blockAgency as any);
router.post('/:id/unblock', COMPANY_OR_SUPER, unblockAgency as any);
router.post('/:id/approve', SUPER_ADMIN, approveAgency as any);
router.post('/:id/reject', SUPER_ADMIN, rejectAgency as any);
router.post('/:id/send-termination-reason', SUPER_ADMIN, sendTerminationReason as any);

export default router;
