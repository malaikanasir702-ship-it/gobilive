import { Router } from 'express';
import { listPolicyLogs, getPolicyLog, createPolicyLog } from './policies.controller';
import { authenticateAdminPanel, requireRoles } from '../../core/middlewares/rbac.middleware';

const router = Router();
router.use(authenticateAdminPanel as any);

const COMPANY_OR_SUPER = requireRoles('company_admin', 'super_admin') as any;

router.get('/', COMPANY_OR_SUPER, listPolicyLogs as any);
router.get('/:id', COMPANY_OR_SUPER, getPolicyLog as any);
router.post('/', COMPANY_OR_SUPER, createPolicyLog as any);

export default router;
