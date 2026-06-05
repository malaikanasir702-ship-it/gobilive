import { Router } from 'express';
import { getDashboard } from './dashboard-admin.controller';
import { authenticateAdminPanel } from '../../core/middlewares/rbac.middleware';

const router = Router();
router.use(authenticateAdminPanel as any);

router.get('/', getDashboard as any);

export default router;
