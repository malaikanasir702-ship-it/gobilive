import { Router } from 'express';
import { listActivityLogs, getActivityLog, exportActivityLogs } from './activity-logs.controller';
import { authenticateAdminPanel, requireRoles } from '../../core/middlewares/rbac.middleware';

const router = Router();
router.use(authenticateAdminPanel as any);

// Activity logs are company_admin only
const COMPANY_ONLY = requireRoles('company_admin') as any;

// /export MUST come before /:id so it is not matched as an id param
router.get('/export', COMPANY_ONLY, exportActivityLogs as any);
router.get('/', COMPANY_ONLY, listActivityLogs as any);
router.get('/:id', COMPANY_ONLY, getActivityLog as any);

export default router;
