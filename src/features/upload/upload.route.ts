import { Router } from 'express';
import { authenticateJWT } from '../../core/middlewares/auth.middleware';
import { uploadMedia } from './upload.middleware';
import { uploadFile } from './upload.controller';

const router = Router();

router.post(
  '/media',
  authenticateJWT as any,
  uploadMedia.single('file'),
  uploadFile as any
);

export default router;
