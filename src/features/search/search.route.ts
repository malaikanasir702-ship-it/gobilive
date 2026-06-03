import { Router } from 'express';
import { authenticateJWT } from '../../core/middlewares/auth.middleware';
import {
  searchUsers,
  getSearchHistory,
  clearSearchHistory,
  getTrendingUsers,
} from './search.controller';

const router = Router();

router.get('/users', authenticateJWT as any, searchUsers as any);
router.get('/trending', getTrendingUsers as any);
router.get('/history', authenticateJWT as any, getSearchHistory as any);
router.delete('/history', authenticateJWT as any, clearSearchHistory as any);

export default router;
