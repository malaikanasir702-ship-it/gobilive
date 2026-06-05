import { Router } from 'express';
import {
  listRegistrationRequests,
  getRegistrationRequest,
  approveRegistration,
  rejectRegistration,
  submitPublicRegistration,
} from './registration.controller';
import { authenticateAdminPanel, requireRoles } from '../../core/middlewares/rbac.middleware';
import { uploadMedia } from '../upload/upload.middleware';

const router = Router();

// ── Public routes (no auth) ────────────────────────────────────────────────
// Rate limiting is applied at app.ts level or can be added here
router.post(
  '/public/:role',
  uploadMedia.array('documents', 5),
  submitPublicRegistration as any
);

// ── Admin-protected routes ─────────────────────────────────────────────────
router.use(authenticateAdminPanel as any);

const COMPANY_OR_SUPER = requireRoles('company_admin', 'super_admin') as any;

router.get('/', COMPANY_OR_SUPER, listRegistrationRequests as any);
router.get('/:id', COMPANY_OR_SUPER, getRegistrationRequest as any);
router.post('/:id/approve', COMPANY_OR_SUPER, approveRegistration as any);
router.post('/:id/reject', COMPANY_OR_SUPER, rejectRegistration as any);

export default router;
