import { Router } from 'express';
import { authenticateJWT } from '../../core/middlewares/auth.middleware';
import {
  getGiftCatalog,
  sendGiftToHost,
  createEmojiGift,
  uploadSvgaGift,
  updateGift,
  deleteGift,
  svgaUploadMiddleware,
  requireAdminJwt,
} from './gifts.controller';

const router = Router();

// ── Public / authenticated ──────────────────────────────────────────────────
router.get('/catalog', getGiftCatalog as any);
router.post('/send', authenticateJWT as any, sendGiftToHost as any);

// ── Admin-only gift management ───────────────────────────────────────────────
// Admin catalog: returns ALL gifts including inactive ones
router.get('/admin/catalog-all', authenticateJWT as any, requireAdminJwt as any, async (_req: any, res: any) => {
  const { Gift } = await import('./gift.model');
  const gifts = await Gift.find().sort({ sortOrder: 1, createdAt: 1 }).lean();
  const normalised = gifts.map((g: any) => ({
    id: g.id, name: g.name, emoji: g.emoji,
    diamondCost: g.diamondCost, rcoinEarned: g.rcoinEarned,
    isVipOnly: g.isVipOnly, animation: g.animation,
    giftType: g.giftType, svgaUrl: g.svgaUrl ?? null,
    isActive: g.isActive, sortOrder: g.sortOrder,
  }));
  res.status(200).json({ success: true, gifts: normalised });
});

// ── Admin-only gift management ───────────────────────────────────────────────
router.post('/admin/create', authenticateJWT as any, requireAdminJwt as any, createEmojiGift as any);

router.post(
  '/admin/upload-svga',
  authenticateJWT as any,
  requireAdminJwt as any,
  (req: any, res: any, next: any) =>
    svgaUploadMiddleware(req, res, (err) => {
      if (err) return res.status(400).json({ success: false, message: err.message });
      next();
    }),
  uploadSvgaGift as any
);

router.patch('/admin/:id', authenticateJWT as any, requireAdminJwt as any, updateGift as any);
router.delete('/admin/:id', authenticateJWT as any, requireAdminJwt as any, deleteGift as any);

export default router;
