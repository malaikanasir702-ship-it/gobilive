import { Router } from 'express';
import { getFeed, createPost, likePost, sharePost, viewPost, getComments, addComment } from './feed.controller';
import { authenticateJWT } from '../../core/middlewares/auth.middleware';

const router = Router();

router.get('/',              authenticateJWT as any, getFeed      as any);
router.post('/',             authenticateJWT as any, createPost   as any);
router.post('/:id/like',     authenticateJWT as any, likePost     as any);
router.post('/:id/share',    authenticateJWT as any, sharePost    as any);
router.post('/:id/view',     authenticateJWT as any, viewPost     as any);
router.get('/:id/comments',  authenticateJWT as any, getComments  as any);
router.post('/:id/comments', authenticateJWT as any, addComment   as any);

export default router;
