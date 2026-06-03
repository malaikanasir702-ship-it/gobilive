import { Router } from 'express';
import { authenticateAdmin } from '../../core/middlewares/admin.middleware';
import {
  getDashboard,
  listUsers,
  adjustUserWallet,
  getSettings,
  updateSettings,
  listAgencies,
  listCoinSellers,
  approveCoinSeller,
  rejectCoinSeller,
  listAgencyPayouts,
  processAgencyPayout,
  listActiveStreams,
  endStreamAdmin,
  listPosts,
  listPendingWithdrawals,
  listWithdrawals,
  processWithdrawal,
  listStreamReports,
  suspendUserAdmin,
  suspendUserByUsername,
} from './admin.controller';

const router = Router();

router.use(authenticateAdmin as any);

router.get('/dashboard', getDashboard as any);
router.get('/users', listUsers as any);
router.post('/users/wallet-adjust', adjustUserWallet as any);
router.get('/settings', getSettings as any);
router.patch('/settings', updateSettings as any);
router.get('/agencies', listAgencies as any);
router.get('/coin-sellers', listCoinSellers as any);
router.post('/coin-sellers/:id/approve', approveCoinSeller as any);
router.post('/coin-sellers/:id/reject', rejectCoinSeller as any);
router.get('/agency-payouts', listAgencyPayouts as any);
router.post('/agency-payouts/process', processAgencyPayout as any);
router.get('/streams', listActiveStreams as any);
router.post('/streams/:channelName/end', endStreamAdmin as any);
router.get('/posts', listPosts as any);
router.get('/withdrawals/pending', listPendingWithdrawals as any);
router.get('/withdrawals', listWithdrawals as any);
router.post('/withdrawals/process', processWithdrawal as any);

// Reports and suspension routes
router.get('/reports', listStreamReports as any);
router.post('/users/:id/suspend', suspendUserAdmin as any);
router.post('/users/suspend-by-username', suspendUserByUsername as any);

export default router;

