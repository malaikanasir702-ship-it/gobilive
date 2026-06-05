import { Router } from 'express';
import {
  listWithdrawals,
  getWithdrawal,
  approveWithdrawal,
  rejectWithdrawal,
  markWithdrawalDone,
  attachTransferSlip,
  attachSlipFile,
} from './withdrawals.controller';
import { uploadMedia } from '../upload/upload.middleware';
import { authenticateAdminPanel, requireRoles } from '../../core/middlewares/rbac.middleware';

const router = Router();
router.use(authenticateAdminPanel as any);

const COMPANY_OR_SUPER = requireRoles('company_admin', 'super_admin') as any;

router.get('/', COMPANY_OR_SUPER, listWithdrawals as any);
router.get('/:id', COMPANY_OR_SUPER, getWithdrawal as any);
router.post('/:id/approve', COMPANY_OR_SUPER, approveWithdrawal as any);
router.post('/:id/reject', COMPANY_OR_SUPER, rejectWithdrawal as any);
router.post('/:id/done', COMPANY_OR_SUPER, markWithdrawalDone as any);
router.post('/:id/attach-slip', COMPANY_OR_SUPER, attachTransferSlip as any);
router.post('/:id/upload-slip', COMPANY_OR_SUPER, uploadMedia.single('file'), attachSlipFile as any);

export default router;
