import { Router } from 'express';
import { authenticateJWT } from '../../core/middlewares/auth.middleware';
import { getGiftCatalog, sendGiftToHost } from './gifts.controller';

const router = Router();

router.get('/catalog', getGiftCatalog as any);
router.post('/send', authenticateJWT as any, sendGiftToHost as any);

export default router;
