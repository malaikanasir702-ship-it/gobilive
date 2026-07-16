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
import { RegistrationRequest } from '../registration/registration-request.model';
import { User } from '../auth/user.model';

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

// ── Resend credentials email (for already-approved registrations) ────────
router.post('/:id/resend-email', COMPANY_OR_SUPER, async (req: any, res: any) => {
  try {
    const id = String(req.params.id);
    const request = await RegistrationRequest.findById(id).lean();
    if (!request) return res.status(404).json({ success: false, message: 'Not found' });
    if (request.status !== 'approved') {
      return res.status(400).json({ success: false, message: 'Can only resend email for approved registrations' });
    }

    const emailTo = request.formData.email;
    if (!emailTo) {
      return res.status(400).json({ success: false, message: 'No email address on this registration' });
    }

    // Find the user account created for this registration
    const user = await User.findOne({
      $or: [
        { email: emailTo.toLowerCase() },
        ...(request.formData.phone ? [{ phone: request.formData.phone }] : []),
      ],
      role: request.role as any,
    }).select('username').lean();

    const username = user?.username ?? `(check admin panel)`;
    const tempPassword = 'Gobilive@123';

    const { sendApprovalEmail } = await import('../../core/services/email.service');
    await sendApprovalEmail({
      to: emailTo,
      fullName: request.formData.fullName || username,
      username,
      password: tempPassword,
      role: request.role,
    });

    res.json({ success: true, message: `Credentials email resent to ${emailTo}` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
