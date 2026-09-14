import { Router } from 'express';
import {
  listSubAdmins,
  approveSubAdmin,
  rejectSubAdmin,
  blockSubAdmin,
  unblockSubAdmin,
  getSubAdminDetail,
  createAgencyBySubAdmin,
  listMyAgenciesForSubAdmin,
} from './sub-admins.controller';
import { authenticateAdminPanel, requireRoles } from '../../core/middlewares/rbac.middleware';

const router = Router();
router.use(authenticateAdminPanel as any);

const GUARD       = requireRoles('company_admin', 'super_admin') as any;
const SUB_ADMIN   = requireRoles('sub_admin') as any;
const SA_OR_ABOVE = requireRoles('company_admin', 'super_admin', 'sub_admin') as any;

// ── Sub Admin's own agency management ────────────────────────────────────────
// sub_admin can list & create their own agencies
// super_admin/company_admin can also POST with { subAdminId } in body
router.get('/my-agencies',  SUB_ADMIN,   listMyAgenciesForSubAdmin as any);
router.post('/my-agencies', SA_OR_ABOVE, createAgencyBySubAdmin as any);

// ── Sub Admin management (super/company admin only) ───────────────────────────
router.get('/', GUARD, listSubAdmins as any);
router.get('/:id', GUARD, getSubAdminDetail as any);
router.post('/:id/approve', GUARD, approveSubAdmin as any);
router.post('/:id/reject', GUARD, rejectSubAdmin as any);
router.post('/:id/block', GUARD, blockSubAdmin as any);
router.post('/:id/unblock', GUARD, unblockSubAdmin as any);

export default router;
