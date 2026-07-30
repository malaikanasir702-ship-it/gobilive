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
  approveBeanRequest,
  rejectBeanRequest,
  getBeanTransfers,
  submitBeanTransfer,
} from './top-ups.controller';
import { authenticateAdminPanel, requireRoles } from '../../core/middlewares/rbac.middleware';
import { uploadMedia } from '../upload/upload.middleware';

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
router.get('/resellers', requireRoles('company_admin', 'super_admin', 'top_up_agent') as any, listResellers as any);
router.post('/resellers/:id/approve', COMPANY_OR_SUPER, approveReseller as any);
router.post('/resellers/:id/reject', COMPANY_OR_SUPER, rejectReseller as any);
router.post('/resellers/:id/block', requireRoles('company_admin', 'super_admin', 'top_up_agent') as any, blockReseller as any);
router.post('/resellers/:id/unblock', requireRoles('company_admin', 'super_admin', 'top_up_agent') as any, unblockReseller as any);

router.get('/bean-requests', requireRoles('company_admin', 'super_admin', 'top_up_agent', 'reseller') as any, getBeanRequestsForTopUp as any);
router.post('/bean-requests', AGENT_OR_RESELLER, submitBeanRequest as any);
router.post('/bean-requests/:id/approve', COMPANY_OR_SUPER, approveBeanRequest as any);
router.post('/bean-requests/:id/reject', COMPANY_OR_SUPER, rejectBeanRequest as any);

router.get('/bean-transfers', COMPANY_OR_AGENT, getBeanTransfers as any);
router.post('/bean-transfers', AGENT_OR_RESELLER, submitBeanTransfer as any);

export default router;
