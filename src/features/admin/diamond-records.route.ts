import { Router } from 'express';
import { listDiamondRecords, getDiamondRecord } from './diamond-records.controller';
import { authenticateAdminPanel, requireRoles } from '../../core/middlewares/rbac.middleware';

const router = Router();
router.use(authenticateAdminPanel as any);

const COMPANY_OR_SUPER = requireRoles('company_admin', 'super_admin') as any;

router.get('/', COMPANY_OR_SUPER, listDiamondRecords as any);
router.get('/:id', COMPANY_OR_SUPER, getDiamondRecord as any);

export default router;
