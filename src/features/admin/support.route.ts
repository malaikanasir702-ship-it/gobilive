import { Router } from 'express';
import { listSupportChats, getSupportChat, replyToSupportChat, closeSupportChat } from './support.controller';
import { authenticateAdminPanel, requireRoles } from '../../core/middlewares/rbac.middleware';

const router = Router();
router.use(authenticateAdminPanel as any);

// All admin roles with portal access can view support chats
const VIEW_GUARD = requireRoles('company_admin', 'super_admin', 'sub_admin', 'agency', 'sub_agency') as any;
// Only agency roles can reply; company/super admin have view-only access (enforced in controller)
const REPLY_GUARD = requireRoles('company_admin', 'super_admin', 'sub_admin', 'agency', 'sub_agency') as any;

router.get('/', VIEW_GUARD, listSupportChats as any);
router.get('/:id', VIEW_GUARD, getSupportChat as any);
router.post('/:id/reply', REPLY_GUARD, replyToSupportChat as any);
router.post('/:id/close', VIEW_GUARD, closeSupportChat as any);

export default router;
