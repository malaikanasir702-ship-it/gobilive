import { Router } from 'express';
import { listTransactions, getTransaction, refundTransaction, manualAdjust } from './transactions.controller';
import { authenticateAdminPanel, requireRoles } from '../../core/middlewares/rbac.middleware';

const router = Router();
router.use(authenticateAdminPanel as any);

const COMPANY_OR_SUPER = requireRoles('company_admin', 'super_admin') as any;

router.get('/', COMPANY_OR_SUPER, listTransactions as any);
router.get('/:id', COMPANY_OR_SUPER, getTransaction as any);
router.post('/:id/refund', COMPANY_OR_SUPER, refundTransaction as any);
router.post('/adjust', COMPANY_OR_SUPER, manualAdjust as any);

export default router;
