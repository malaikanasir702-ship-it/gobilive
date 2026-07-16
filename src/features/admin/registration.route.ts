import { Router } from 'express';
import {
  listRegistrationRequests,
  getRegistrationRequest,
  approveRegistration,
  rejectRegistration,
  submitPublicRegistration,
  getMyRegistrationStatus,
} from './registration.controller';
import { authenticateAdminPanel, requireRoles } from '../../core/middlewares/rbac.middleware';
import { uploadMedia } from '../upload/upload.middleware';
import { authenticateJWT } from '../../core/middlewares/auth.middleware';

const router = Router();

// ── Public routes (no auth) ────────────────────────────────────────────────
router.post(
  '/public/:role',
  uploadMedia.array('documents', 5),
  submitPublicRegistration as any
);

// ── App user route — check own registration status (requires app JWT) ──────
router.get('/my-status', authenticateJWT as any, getMyRegistrationStatus as any);

// ── Admin-protected routes ─────────────────────────────────────────────────
router.use(authenticateAdminPanel as any);

const COMPANY_OR_SUPER = requireRoles('company_admin', 'super_admin') as any;

router.get('/', COMPANY_OR_SUPER, listRegistrationRequests as any);
router.get('/:id', COMPANY_OR_SUPER, getRegistrationRequest as any);
router.post('/:id/approve', COMPANY_OR_SUPER, approveRegistration as any);
router.post('/:id/reject', COMPANY_OR_SUPER, rejectRegistration as any);

// ── Test email route ─────────────────────────────────────────────────────
router.post('/test-email', COMPANY_OR_SUPER, async (req: any, res: any) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ success: false, message: 'to is required' });
  try {
    const { sendApprovalEmail } = await import('../../core/services/email.service');
    await sendApprovalEmail({
      to,
      fullName: 'Test User',
      username: 'testuser_xyz',
      password: 'Gobilive@123',
      role: 'agency',
    });
    res.json({ success: true, message: `Test email sent to ${to}` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message, stack: err.stack });
  }
});

export default router;
