import { Router } from 'express';
import { authenticateJWT } from '../../core/middlewares/auth.middleware';
import {
  confirmPayment,
  convertDiamonds,
  createPaymentIntent,
  getBalance,
  getCatalog,
  getTransactions,
  purchaseVipWithDiamonds,
  withdrawRcoinsHandler,
} from './wallet.controller';
import { verifyGooglePlayPurchase } from './iap.controller';

const router = Router();

router.get('/catalog', authenticateJWT as any, getCatalog as any);
router.get('/balance', authenticateJWT as any, getBalance as any);
router.get('/transactions', authenticateJWT as any, getTransactions as any);
router.post('/stripe/create-payment-intent', authenticateJWT as any, createPaymentIntent as any);
router.post('/stripe/confirm-payment', authenticateJWT as any, confirmPayment as any);
router.post('/convert', authenticateJWT as any, convertDiamonds as any);
router.post('/withdraw', authenticateJWT as any, withdrawRcoinsHandler as any);
router.post('/vip/purchase-diamonds', authenticateJWT as any, purchaseVipWithDiamonds as any);
router.post('/iap/google/verify', authenticateJWT as any, verifyGooglePlayPurchase as any);

export default router;
