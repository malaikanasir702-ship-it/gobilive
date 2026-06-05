import { Router } from 'express';
import { adminLogin, adminLogout } from '../admin/admin-auth.controller';
import { authenticateJWT } from '../../core/middlewares/auth.middleware';

const router = Router();

router.post('/login', adminLogin as any);
router.post('/logout', authenticateJWT as any, adminLogout as any);

export default router;
