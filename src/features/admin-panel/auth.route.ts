import { Router } from 'express';
import { adminLogin, adminLogout, adminChangePassword, checkRoles } from '../admin/admin-auth.controller';
import { adminForgotPassword, adminVerifyOtpReset } from '../admin/admin-auth.controller';
import { authenticateJWT } from '../../core/middlewares/auth.middleware';

const router = Router();

router.post('/check-roles', checkRoles as any);
router.post('/login', adminLogin as any);
router.post('/logout', authenticateJWT as any, adminLogout as any);
router.post('/change-password', adminChangePassword as any);

// Forgot password — OTP flow for admin panel
router.post('/forgot-password', adminForgotPassword as any);
router.post('/reset-password', adminVerifyOtpReset as any);

export default router;
