import { Router } from 'express';
import { authenticateJWT } from '../../core/middlewares/auth.middleware';
import { authenticateAdminPanel } from '../../core/middlewares/rbac.middleware';
import {
  getFrameCatalog,
  getAllFramesAdmin,
  uploadFrame,
  updateFrame,
  deleteFrame,
  purchaseFrame,
  activateFrame,
  getMyFrames,
  frameUploadMiddleware,
} from './frames.controller';

const router = Router();

// ── Public / User-authenticated ──────────────────────────────────────────────
// GET  /api/frames           — browse all active frames (store catalog)
router.get('/', getFrameCatalog as any);

// GET  /api/frames/my        — get user's purchased frames + active frame
router.get('/my', authenticateJWT as any, getMyFrames as any);

// POST /api/frames/purchase/:id  — purchase a frame with Beans
router.post('/purchase/:id', authenticateJWT as any, purchaseFrame as any);

// POST /api/frames/activate/:id  — set a purchased frame as active
router.post('/activate/:id', authenticateJWT as any, activateFrame as any);

// ── Admin panel routes (company_admin JWT) ───────────────────────────────────
// GET  /api/frames/admin/all       — all frames including inactive
router.get('/admin/all', authenticateAdminPanel as any, getAllFramesAdmin as any);

// POST /api/frames/admin/upload    — upload new frame PNG
router.post(
  '/admin/upload',
  authenticateAdminPanel as any,
  (req: any, res: any, next: any) =>
    frameUploadMiddleware(req, res, (err) => {
      if (err) return res.status(400).json({ success: false, message: err.message });
      next();
    }),
  uploadFrame as any
);

// PATCH /api/frames/admin/:id      — update name/price/scale/isActive/sortOrder
router.patch('/admin/:id', authenticateAdminPanel as any, updateFrame as any);

// DELETE /api/frames/admin/:id     — delete frame permanently
router.delete('/admin/:id', authenticateAdminPanel as any, deleteFrame as any);

export default router;
