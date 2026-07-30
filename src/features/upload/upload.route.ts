import { Router } from 'express';
import { authenticateJWT } from '../../core/middlewares/auth.middleware';
import { authenticateAdminPanel } from '../../core/middlewares/rbac.middleware';
import { uploadMedia } from './upload.middleware';
import { uploadFile, adminUploadFile } from './upload.controller';

const router = Router();

router.post(
  '/media',
  authenticateJWT as any,
  uploadMedia.single('file'),
  uploadFile as any
);

// Admin panel upload — uses admin JWT auth
router.post(
  '/admin-file',
  authenticateAdminPanel as any,
  uploadMedia.single('file'),
  adminUploadFile as any
);

export default router;
