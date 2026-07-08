import { Router } from 'express';
import { authenticateJWT } from '../../core/middlewares/auth.middleware';
import { getSounds, getSoundById, createSound, useSound } from './sound.controller';

const router = Router();

router.get('/', authenticateJWT as any, getSounds as any);
router.get('/:id', authenticateJWT as any, getSoundById as any);
router.post('/', authenticateJWT as any, createSound as any);          // admin can seed sounds
router.post('/:id/use', authenticateJWT as any, useSound as any);

export default router;
