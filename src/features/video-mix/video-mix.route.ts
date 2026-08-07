import { Router } from 'express';
import { authenticateJWT } from '../../core/middlewares/auth.middleware';
import multer from 'multer';
import path from 'path';
import { mixVideoAudio } from './video-mix.controller';

// Multer: store video in /tmp with original extension
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, '/tmp'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    cb(null, `upload_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files allowed'));
    }
  },
});

const router = Router();

/**
 * POST /api/video-mix/mix
 * Mixes background audio into a recorded video using FFmpeg.
 * Accepts either a video file upload OR a videoUrl in body.
 */
router.post(
  '/mix',
  authenticateJWT as any,
  upload.single('video'),
  mixVideoAudio as any
);

export default router;
