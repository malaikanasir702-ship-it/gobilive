import { Router } from 'express';
import { listGames, getGame, updateGame, getGameStats } from './games.controller';
import { authenticateAdminPanel, requireRoles } from '../../core/middlewares/rbac.middleware';

const router = Router();
router.use(authenticateAdminPanel as any);

const COMPANY_ONLY = requireRoles('company_admin') as any;

router.get('/', COMPANY_ONLY, listGames as any);
router.get('/:id', COMPANY_ONLY, getGame as any);
router.patch('/:id', COMPANY_ONLY, updateGame as any);
router.get('/:id/stats', COMPANY_ONLY, getGameStats as any);

export default router;
