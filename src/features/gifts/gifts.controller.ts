import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import { Gift } from './gift.model';
import { GIFT_CATALOG } from './gift.config';   // kept for getGiftById helper
import { getGiftById } from './gift.config';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { addXpFromDiamondSpend } from '../auth/leveling.service';
import LiveRoom from '../live/live.model';
import { User } from '../auth/user.model';

// ─── Admin guard middleware ───────────────────────────────────────────────────
/** Allows only company_admin and super_admin roles (via regular JWT auth). */
export const requireAdminJwt = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const role = (req.user as any)?.role;
  const adminRoles = ['company_admin', 'super_admin'];
  if (!role || !adminRoles.includes(role)) {
    res.status(403).json({ success: false, message: 'Admin access required.' });
    return;
  }
  next();
};

// ─── Multer — temp disk storage for SVGA uploads ────────────────────────────
const _storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, '/tmp'),
  filename: (_req, file, cb) =>
    cb(null, `gift-${Date.now()}${path.extname(file.originalname)}`),
});

export const svgaUploadMiddleware = multer({
  storage: _storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB max
  fileFilter: (_req, file, cb) => {
    // Accept Lottie .json files
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.json' || file.mimetype === 'application/json' || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error('Only Lottie .json files are allowed.'));
    }
  },
}).single('file');

// ─── Seed helper — called once on startup if DB is empty ────────────────────
export async function seedGiftCatalogIfEmpty(): Promise<void> {
  try {
    const count = await Gift.countDocuments();
    if (count > 0) return;

    const docs = GIFT_CATALOG.map((g, i) => ({
      id: g.id,
      name: g.name,
      emoji: g.emoji,
      diamondCost: g.diamondCost,
      rcoinEarned: g.rcoinEarned,
      isVipOnly: g.isVipOnly,
      animation: g.animation,
      giftType: 'emoji' as const,
      svgaUrl: undefined,
      isActive: true,
      sortOrder: i,
    }));

    await Gift.insertMany(docs);
    console.log('[Gifts] Seeded', docs.length, 'emoji gifts into MongoDB.');
  } catch (err) {
    console.warn('[Gifts] Seed skipped:', (err as Error).message);
  }
}

// ─── GET /api/gifts/catalog ──────────────────────────────────────────────────
export const getGiftCatalog = async (_req: Request, res: Response): Promise<void> => {
  try {
    const gifts = await Gift.find({ isActive: true }).sort({ sortOrder: 1, createdAt: 1 }).lean();
    // Normalise _id → id for backwards-compat with Flutter (which uses gift['id'])
    const normalised = gifts.map((g) => ({
      id: g.id,
      name: g.name,
      emoji: g.emoji,
      diamondCost: g.diamondCost,
      rcoinEarned: g.rcoinEarned,
      isVipOnly: g.isVipOnly,
      animation: g.animation,
      giftType: g.giftType,
      svgaUrl: g.svgaUrl ?? null,
      isActive: g.isActive,
      sortOrder: g.sortOrder,
    }));
    res.status(200).json({ success: true, gifts: normalised });
  } catch (err: any) {
    console.error('[getGiftCatalog]', err);
    res.status(500).json({ success: false, message: 'Failed to fetch gift catalog.' });
  }
};

// ─── POST /api/gifts/admin/create  (admin only — creates an emoji gift) ──────
export const createEmojiGift = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, name, emoji, diamondCost, rcoinEarned, isVipOnly, animation, sortOrder } = req.body;
    if (!id || !name || !diamondCost) {
      res.status(400).json({ success: false, message: 'id, name, and diamondCost are required.' });
      return;
    }
    const gift = await Gift.create({
      id,
      name,
      emoji: emoji ?? '🎁',
      diamondCost: Number(diamondCost),
      rcoinEarned: Number(rcoinEarned ?? 0),
      isVipOnly: Boolean(isVipOnly),
      animation: animation ?? 'float',
      giftType: 'emoji',
      svgaUrl: undefined,
      isActive: true,
      sortOrder: Number(sortOrder ?? 99),
    });
    res.status(201).json({ success: true, gift });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /api/gifts/admin/upload-svga  (admin only — uploads SVGA to Cloudinary) ─
export const uploadSvgaGift = async (req: AuthRequest, res: Response): Promise<void> => {
  const file = (req as any).file as Express.Multer.File | undefined;

  try {
    if (!file) {
      res.status(400).json({ success: false, message: 'No file uploaded.' });
      return;
    }

    const { id, name, emoji, diamondCost, rcoinEarned, isVipOnly, animation, sortOrder } = req.body;
    if (!id || !name || !diamondCost) {
      fs.unlinkSync(file.path);
      res.status(400).json({ success: false, message: 'id, name, and diamondCost are required.' });
      return;
    }

    // Upload SVGA to Cloudinary as a raw file (not image/video)
    const result = await cloudinary.uploader.upload(file.path, {
      folder: 'gobilive_gifts',
      resource_type: 'raw',         // SVGA is not a standard media type
      public_id: `svga_${id}_${Date.now()}`,
      overwrite: false,
    });

    // Clean up temp file
    try { fs.unlinkSync(file.path); } catch (_) {}

    // Persist gift record
    const gift = await Gift.create({
      id,
      name,
      emoji: emoji ?? '🎁',
      diamondCost: Number(diamondCost),
      rcoinEarned: Number(rcoinEarned ?? 0),
      isVipOnly: Boolean(isVipOnly),
      animation: animation ?? 'svga',
      giftType: 'svga',
      svgaUrl: result.secure_url,
      isActive: true,
      sortOrder: Number(sortOrder ?? 99),
    });

    res.status(201).json({ success: true, gift, cloudinaryUrl: result.secure_url });
  } catch (err: any) {
    // Clean up temp file on error
    if ((req as any).file?.path) {
      try { fs.unlinkSync((req as any).file.path); } catch (_) {}
    }
    console.error('[uploadSvgaGift]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PATCH /api/gifts/admin/:id  (admin only — toggle active / update fields) ─
export const updateGift = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const allowed = ['name', 'emoji', 'diamondCost', 'rcoinEarned', 'isVipOnly', 'animation', 'isActive', 'sortOrder'];
    const updates: Record<string, any> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    const gift = await Gift.findOneAndUpdate({ id }, updates, { new: true });
    if (!gift) {
      res.status(404).json({ success: false, message: 'Gift not found.' });
      return;
    }
    res.status(200).json({ success: true, gift });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── DELETE /api/gifts/admin/:id  (admin only — soft delete) ─────────────────
export const deleteGift = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const gift = await Gift.findOneAndUpdate({ id }, { isActive: false }, { new: true });
    if (!gift) {
      res.status(404).json({ success: false, message: 'Gift not found.' });
      return;
    }
    res.status(200).json({ success: true, message: 'Gift deactivated.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /api/gifts/send ────────────────────────────────────────────────────

async function processGiftPayment(
  senderId: string,
  hostId: string,
  diamondCost: number,
  rcoinEarned: number,
  giftName: string
): Promise<void> {
  try {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const sender = await User.findById(senderId).session(session);
      if (!sender) throw new Error('Sender not found.');
      if (sender.diamonds < diamondCost) throw new Error('Insufficient diamonds.');
      sender.diamonds -= diamondCost;
      await sender.save({ session });

      const host = await User.findById(hostId).session(session);
      if (host && rcoinEarned > 0) {
        host.rcoins += rcoinEarned;
        await host.save({ session });
      }

      await session.commitTransaction();
      session.endSession();
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } catch (_txErr) {
    // Fallback: non-transactional for standalone MongoDB
    const sender = await User.findById(senderId);
    if (!sender) throw new Error('Sender not found.');
    if (sender.diamonds < diamondCost) throw new Error('Insufficient diamonds.');
    sender.diamonds -= diamondCost;
    await sender.save();
    if (rcoinEarned > 0) {
      await User.findByIdAndUpdate(hostId, { $inc: { rcoins: rcoinEarned } });
    }
  }
}

export const sendGiftToHost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const { giftId, channelName, count = 1 } = req.body;
    if (!giftId || !channelName) {
      res.status(400).json({ success: false, message: 'giftId and channelName are required.' });
      return;
    }

    // Look up gift from MongoDB first, fall back to static config
    let gift: { id: string; name: string; emoji: string; diamondCost: number; rcoinEarned: number; giftType?: string; svgaUrl?: string | null; animation?: string } | null | undefined =
      await Gift.findOne({ id: giftId, isActive: true }).lean();

    if (!gift) {
      // Legacy fallback: static config
      const staticGift = getGiftById(giftId);
      if (!staticGift) {
        res.status(400).json({ success: false, message: `Invalid gift id: ${giftId}` });
        return;
      }
      gift = { ...staticGift, giftType: 'emoji', svgaUrl: undefined };
    }

    const room = await LiveRoom.findOne({ channelName });
    if (!room) {
      res.status(404).json({ success: false, message: 'Live room not found.' });
      return;
    }

    const safeCount = Math.max(1, Number(count));
    const totalCost = gift.diamondCost * safeCount;
    const totalRcoins = gift.rcoinEarned * safeCount;

    await processGiftPayment(req.user.id, room.hostId.toString(), totalCost, totalRcoins, gift.name);

    room.totalGifts += safeCount;
    room.totalDiamondsEarned += totalCost;
    await room.save();

    try { await addXpFromDiamondSpend(req.user.id, totalCost); } catch (_) {}

    res.status(200).json({
      success: true,
      gift: {
        id: gift.id,
        name: gift.name,
        emoji: gift.emoji,
        giftType: gift.giftType ?? 'emoji',
        svgaUrl: gift.svgaUrl ?? null,
        animation: gift.animation ?? 'float',
        count: safeCount,
        totalCost,
        totalRcoins,
      },
      hostId: room.hostId,
      senderUsername: req.user.username,
    });
  } catch (error: any) {
    console.error('[sendGiftToHost]', error);
    const knownClientErrors = ['Insufficient diamonds.', 'Sender not found.', 'Live room not found.'];
    const statusCode = knownClientErrors.includes(error.message) ? 400 : (error.status || 500);
    res.status(statusCode).json({ success: false, message: error.message || 'Failed to send gift.' });
  }
};
