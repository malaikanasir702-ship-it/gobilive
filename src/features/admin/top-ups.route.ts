import { Router } from 'express';
import {
  listTopUpAgents,
  approveTopUpAgent,
  rejectTopUpAgent,
  blockTopUpAgent,
  unblockTopUpAgent,
  listResellers,
  approveReseller,
  rejectReseller,
  blockReseller,
  unblockReseller,
  getBeanRequestsForTopUp,
  submitBeanRequest,
  getBeanTransfers,
  submitBeanTransfer,
} from './top-ups.controller';
import { authenticateAdminPanel, requireRoles } from '../../core/middlewares/rbac.middleware';

const router = Router();
router.use(authenticateAdminPanel as any);

const COMPANY_OR_SUPER = requireRoles('company_admin', 'super_admin') as any;
const COMPANY_OR_AGENT = requireRoles('company_admin', 'top_up_agent') as any;
const AGENT_OR_RESELLER = requireRoles('top_up_agent', 'reseller') as any;

router.get('/agents', COMPANY_OR_SUPER, listTopUpAgents as any);
router.post('/agents/:id/approve', COMPANY_OR_SUPER, approveTopUpAgent as any);
router.post('/agents/:id/reject', COMPANY_OR_SUPER, rejectTopUpAgent as any);
router.post('/agents/:id/block', COMPANY_OR_SUPER, blockTopUpAgent as any);
router.post('/agents/:id/unblock', COMPANY_OR_SUPER, unblockTopUpAgent as any);

router.get('/agents/:agentId/resellers', COMPANY_OR_SUPER, listResellers as any);
router.get('/resellers', COMPANY_OR_SUPER, listResellers as any);
router.post('/resellers/:id/approve', COMPANY_OR_SUPER, approveReseller as any);
router.post('/resellers/:id/reject', COMPANY_OR_SUPER, rejectReseller as any);
router.post('/resellers/:id/block', COMPANY_OR_SUPER, blockReseller as any);
router.post('/resellers/:id/unblock', COMPANY_OR_SUPER, unblockReseller as any);

router.get('/bean-requests', COMPANY_OR_AGENT, getBeanRequestsForTopUp as any);
router.post('/bean-requests', AGENT_OR_RESELLER, submitBeanRequest as any);

router.get('/bean-transfers', COMPANY_OR_AGENT, getBeanTransfers as any);
router.post('/bean-transfers', AGENT_OR_RESELLER, submitBeanTransfer as any);

export default router;
