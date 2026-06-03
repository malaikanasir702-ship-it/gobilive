import { Router } from 'express';
import { authenticateJWT } from '../../core/middlewares/auth.middleware';
import { getSpinConfig, spinWheel } from './game.controller';

const router = Router();

router.get('/spin/config', authenticateJWT as any, getSpinConfig as any);
router.post('/spin', authenticateJWT as any, spinWheel as any);

export default router;
