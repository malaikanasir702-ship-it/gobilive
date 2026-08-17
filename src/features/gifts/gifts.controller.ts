import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import { Gift } from './gift.model';
import { GIFT_CATALOG, getGiftById } from './gift.config';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { addXpFromDiamondSpend } from '../auth/leveling.service';
import LiveRoom from '../live/live.model';
import { User } from '../auth/user.model';

// Lazy import to avoid circular deps — seat.controller exports _io via getIo
let _getIo: (() => import('socket.io').Server | null) | null = null;
export function injectGiftIo(fn: () => import('socket.io').Server | null) {
  _getIo = fn;
}
function getIo() { return _getIo?.() ?? null; }

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
    // Accept .svga files only
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.svga' || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error('Only .svga files are allowed.'));
    }
  },
}).single('file');

// ─── Seed helper — called once on startup if DB is empty ────────────────────
export async function seedGiftCatalogIfEmpty(): Promise<void> {
  try {
    const { TIKTOK_GIFTS_SEED } = await import('../../scripts/seed-tiktok-gifts');
    for (const g of TIKTOK_GIFTS_SEED) {
      await Gift.updateOne(
        { id: g.id },
        {
          $set: {
            ...g,
            isVipOnly: false,
            animation: 'float',
            giftType: 'emoji',
            isActive: true,
          },
        },
        { upsert: true }
      );
    }
    console.log('[Gifts] Seeded TikTok gifts catalog into MongoDB.');
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
    const resolvedGiftType = req.body.giftType === 'svga' ? 'svga' : 'emoji';

    const gift = await Gift.create({
      id,
      name,
      emoji: emoji ?? '🎁',
      diamondCost: Number(diamondCost),
      rcoinEarned: Number(rcoinEarned ?? 0),
      isVipOnly: Boolean(isVipOnly),
      animation: animation ?? 'float',
      giftType: resolvedGiftType,
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

    // Upload SVGA to Cloudinary as a raw file
    const result = await cloudinary.uploader.upload(file.path, {
      folder: 'gobilive_gifts',
      resource_type: 'raw',         // .svga is not a standard media type
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

// ─── DELETE /api/gifts/admin/:id  (admin only — hard delete from DB) ─────────
export const deleteGift = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const gift = await Gift.findOneAndDelete({ id });
    if (!gift) {
      res.status(404).json({ success: false, message: 'Gift not found.' });
      return;
    }
    res.status(200).json({ success: true, message: 'Gift permanently deleted.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /api/gifts/purchase  (buy a cosmetic gift item from store) ─────────
export const purchaseGiftItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const { giftId, quantity = 1 } = req.body;
    if (!giftId) {
      res.status(400).json({ success: false, message: 'giftId is required.' });
      return;
    }

    // Look up gift — DB first, then static config
    let gift: { id: string; name: string; emoji: string; diamondCost: number; rcoinEarned: number } | null | undefined =
      await Gift.findOne({ id: giftId, isActive: true }).lean();

    if (!gift) {
      const staticGift = getGiftById(giftId);
      if (!staticGift) {
        res.status(400).json({ success: false, message: `Invalid gift id: ${giftId}` });
        return;
      }
      gift = staticGift;
    }

    const safeQty = Math.max(1, Number(quantity));
    const totalCost = gift.diamondCost * safeQty;

    // Deduct diamonds atomically
    const updated = await User.findOneAndUpdate(
      { _id: req.user.id, diamonds: { $gte: totalCost } },
      { $inc: { diamonds: -totalCost } },
      { new: true }
    ).select('diamonds rcoins username').lean();

    if (!updated) {
      res.status(400).json({ success: false, message: 'Insufficient diamonds.' });
      return;
    }

    // XP for diamond spend
    try { await addXpFromDiamondSpend(req.user.id, totalCost); } catch (_) {}

    res.status(200).json({
      success: true,
      message: `Successfully purchased ${safeQty}× ${gift.name}!`,
      giftId: gift.id,
      giftName: gift.name,
      quantity: safeQty,
      diamondsSpent: totalCost,
      remainingDiamonds: updated.diamonds,
      user: { diamonds: updated.diamonds, rcoins: updated.rcoins },
    });
  } catch (error: any) {
    console.error('[purchaseGiftItem]', error);
    res.status(500).json({ success: false, message: error.message || 'Purchase failed.' });
  }
};

// ─── POST /api/gifts/send ────────────────────────────────────────────────────

async function processGiftPayment(
  senderId: string,
  hostId: string,
  beansCost: number,
  beansEarned: number,
  _giftName: string
): Promise<void> {
  // Deduct beans atomically without triggering full-document schema validation
  const updatedSender = await User.findOneAndUpdate(
    { _id: senderId, beanWallet: { $gte: beansCost } },
    { $inc: { beanWallet: -beansCost } },
    { new: true }
  ).select('beanWallet').lean();

  if (!updatedSender) {
    const sender = await User.findById(senderId).select('beanWallet').lean();
    if (!sender) throw new Error('Sender not found.');
    throw new Error('Insufficient beans.');
  }

  // Credit beans to recipient
  if (beansEarned > 0) {
    await User.updateOne(
      { _id: hostId },
      { $inc: { beanWallet: beansEarned } }
    );
  }
}

export const sendGiftToHost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    // ── Gifting suspension check (negative bean balance) ─────────────────────
    const senderProfile = await User.findById(req.user.id).select('isGiftingSuspended').lean();
    if (senderProfile?.isGiftingSuspended) {
      res.status(403).json({
        success: false,
        message: 'Account restricted due to negative balance. Please clear your dues.',
      });
      return;
    }

    // targetUserId — optional: gift a specific seat member instead of host
    const { giftId, channelName, count = 1, targetUserId } = req.body;
    if (!giftId || !channelName) {
      res.status(400).json({ success: false, message: 'giftId and channelName are required.' });
      return;
    }

    // Look up gift from MongoDB first, fall back to static config
    let gift: { id: string; name: string; emoji: string; diamondCost: number; rcoinEarned: number; giftType?: string; svgaUrl?: string | null; animation?: string } | null | undefined =
      await Gift.findOne({ id: giftId, isActive: true }).lean();

    if (!gift) {
      // ── Local TikTok-style assets (id starts with 'local_') ──────────────
      // These gifts are bundled inside the app — no DB entry needed.
      // The client sends the cost; we trust it because Beans are server-verified.
      if (typeof giftId === 'string' && giftId.startsWith('local_')) {
        const clientCost = Math.max(1, Number(req.body.cost ?? req.body.diamondCost ?? 1));
        const rcoin = Math.floor(clientCost * 0.5); // host earns 50% as beans
        const friendlyName = giftId
          .replace('local_', '')
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());
        gift = {
          id: giftId,
          name: friendlyName,
          emoji: '🎁',
          diamondCost: clientCost,
          rcoinEarned: rcoin,
          giftType: 'local',
          svgaUrl: null,
          animation: 'float',
        };
      } else {
        const staticGift = getGiftById(giftId);
        if (!staticGift) {
          res.status(400).json({ success: false, message: `Invalid gift id: ${giftId}` });
          return;
        }
        gift = { ...staticGift, giftType: 'emoji', svgaUrl: undefined };
      }
    }

    const room = await LiveRoom.findOne({ channelName });
    if (!room) {
      res.status(404).json({ success: false, message: 'Live room not found.' });
      return;
    }

    const safeCount = Math.max(1, Number(count));
    const totalCost = gift.diamondCost * safeCount; // total Beans cost
    const totalBeansEarned = totalCost; // 1:1 crediting: host earns 100% of gift beans

    // Determine the actual recipient: targetUserId if provided & valid, else room host
    let recipientId = room.hostId.toString();
    let recipientUsername = room.hostUsername;
    if (targetUserId && targetUserId !== req.user.id) {
      // Validate that the target is actually in a seat in this room
      const targetSeat = room.seats.find(
        (s) => s.userId && s.userId.toString() === targetUserId
      );
      if (targetSeat) {
        recipientId = targetUserId;
        const targetUser = await User.findById(targetUserId).select('username').lean();
        recipientUsername = targetUser?.username ?? targetSeat.username ?? 'Unknown';
      }
    }

    // ── Self-gifting prevention check ──────────────────────────────────────────
    if (req.user.id === recipientId) {
      res.status(400).json({ success: false, message: 'You cannot send a gift to yourself.' });
      return;
    }

    await processGiftPayment(req.user.id, recipientId, totalCost, totalBeansEarned, gift.name);

    room.totalGifts += safeCount;
    room.totalDiamondsEarned += totalCost;
    await room.save();

    try { await addXpFromDiamondSpend(req.user.id, totalCost); } catch (_) {}

    // Fetch updated balances so the live UI can show them in real-time
    const [senderUpdated, recipientUpdated] = await Promise.all([
      User.findById(req.user.id).select('beanWallet diamonds username').lean(),
      User.findById(recipientId).select('beanWallet diamonds rcoins username').lean(),
    ]);

    // Broadcast balance updates to the live room via Socket.IO
    const io = getIo();
    if (io) {
      // Broadcast gift animation to everyone in the room
      io.to(channelName).emit('gift_received', {
        roomId: channelName,
        sender: req.user.username,
        giftName: gift.name,
        giftId: gift.id,          // slug e.g. 'lion', 'car' — used by Flutter matcher
        emoji: gift.emoji,
        giftType: gift.giftType ?? 'emoji',
        svgaUrl: gift.svgaUrl ?? null,
        count: safeCount,
        cost: totalCost,
      });

      // Broadcast bean & diamond balance updates
      const balanceUpdatePayload = {
        roomId: channelName,
        sender: {
          userId: req.user.id,
          username: req.user.username,
          beans: senderUpdated?.beanWallet ?? 0,
          diamonds: senderUpdated?.diamonds ?? 0,
        },
        recipient: {
          userId: recipientId,
          username: recipientUsername,
          beans: recipientUpdated?.beanWallet ?? 0,
          diamonds: recipientUpdated?.diamonds ?? 0,
          rcoins: recipientUpdated?.rcoins ?? 0,
        },
      };

      io.to(channelName).emit('bean_balance_update', balanceUpdatePayload);
      io.to(channelName).emit('diamond_balance_update', balanceUpdatePayload);
    }

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
        totalBeansEarned,
      },
      recipientId,
      recipientUsername,
      hostId: room.hostId,
      senderUsername: req.user.username,
      senderBeans: senderUpdated?.beanWallet ?? 0,
      senderDiamonds: senderUpdated?.diamonds ?? 0,
    });
  } catch (error: any) {
    console.error('[sendGiftToHost]', error);
    const knownClientErrors = ['Insufficient beans.', 'Sender not found.', 'Live room not found.'];
    const statusCode = knownClientErrors.includes(error.message) ? 400 : (error.status || 500);
    res.status(statusCode).json({ success: false, message: error.message || 'Failed to send gift.' });
  }
};
