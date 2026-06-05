import { Router } from 'express';
import { adminLogin, adminLogout } from './admin-auth.controller';

const router = Router();

router.post('/login', adminLogin as any);
router.post('/logout', adminLogout as any);

export default router;
