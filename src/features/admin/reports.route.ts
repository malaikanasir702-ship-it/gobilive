import { Router } from 'express';
import { listReports, getReport, dismissReport, escalateReport } from './reports.controller';
import { authenticateAdminPanel, requireRoles } from '../../core/middlewares/rbac.middleware';

const router = Router();
router.use(authenticateAdminPanel as any);

// Agency has view-only access; all others have full access
const VIEW_GUARD = requireRoles('company_admin', 'super_admin', 'sub_admin', 'agency', 'sub_agency') as any;
const ACTION_GUARD = requireRoles('company_admin', 'super_admin', 'sub_admin') as any;

router.get('/', VIEW_GUARD, listReports as any);
router.get('/:id', VIEW_GUARD, getReport as any);
router.post('/:id/dismiss', ACTION_GUARD, dismissReport as any);
router.post('/:id/escalate', ACTION_GUARD, escalateReport as any);

export default router;
