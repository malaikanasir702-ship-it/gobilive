import { Router } from 'express';
import { getRevenueAnalytics } from './revenue.controller';
import { authenticateAdminPanel } from '../../core/middlewares/rbac.middleware';

const router = Router();

// GET /api/admin-panel/v1/revenue
router.get('/', authenticateAdminPanel, getRevenueAnalytics);

export default router;
