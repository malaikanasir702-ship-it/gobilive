import { Router } from 'express';
import { authenticateJWT } from '../../core/middlewares/auth.middleware';
import { applyAsCoinSeller, getMyCoinSellerProfile, recordSale, getMySales } from './coin-seller.controller';

const router = Router();

router.get('/mine', authenticateJWT as any, getMyCoinSellerProfile as any);
router.post('/apply', authenticateJWT as any, applyAsCoinSeller as any);
router.post('/sales', authenticateJWT as any, recordSale as any);
router.get('/sales/mine', authenticateJWT as any, getMySales as any);

export default router;
