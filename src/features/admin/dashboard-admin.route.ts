import { Router } from 'express';
import { getDashboard } from './dashboard-admin.controller';
import { getCharts } from './charts.controller';
import { authenticateAdminPanel, requireRoles } from '../../core/middlewares/rbac.middleware';

const router = Router();
router.use(authenticateAdminPanel as any);

router.get('/', getDashboard as any);
router.get('/charts', requireRoles('company_admin', 'super_admin') as any, getCharts as any);

export default router;
