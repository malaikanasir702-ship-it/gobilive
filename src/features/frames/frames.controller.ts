import { Request, Response } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import { Frame } from './frame.model';
import { User } from '../auth/user.model';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { AdminAuthRequest } from '../../core/middlewares/rbac.middleware';
import { logActivity } from '../activity-log/activity-log.service';

// ─── Multer — temp disk storage for PNG frame uploads ────────────────────────
const _storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, '/tmp'),
  filename: (_req, file, cb) =>
    cb(null, `frame-${Date.now()}${path.extname(file.originalname)}`),
});

export const frameUploadMiddleware = multer({
  storage: _storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype;
    if (ext === '.png' && mime === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Only PNG files are accepted for avatar frames.'));
    }
  },
}).single('file');

// ─── GET /api/frames  — public catalog (active only) ────────────────────────
export const getFrameCatalog = async (_req: Request, res: Response): Promise<void> => {
  try {
    const frames = await Frame.find({ isActive: true })
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean();
    res.status(200).json({ success: true, frames });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /api/frames/admin/all  — admin: all frames incl. inactive ───────────
export const getAllFramesAdmin = async (_req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const frames = await Frame.find().sort({ sortOrder: 1, createdAt: -1 }).lean();
    res.status(200).json({ success: true, frames });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /api/frames/admin/upload  — company_admin uploads frame PNG ────────
export const uploadFrame = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  const file = (req as any).file as Express.Multer.File | undefined;
  try {
    if (!file) {
      res.status(400).json({ success: false, message: 'No file uploaded.' });
      return;
    }

    const { name, price, avatarScale, category, sortOrder } = req.body;

    // Validate required fields
    if (!name || !name.trim()) {
      fs.unlinkSync(file.path);
      res.status(400).json({ success: false, message: 'Frame name is required.' });
      return;
    }
    const parsedPrice = Number(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      fs.unlinkSync(file.path);
      res.status(400).json({ success: false, message: 'Price must be a non-negative number.' });
      return;
    }
    const parsedScale = Number(avatarScale ?? 0.60);
    if (isNaN(parsedScale) || parsedScale < 0.3 || parsedScale > 0.9) {
      fs.unlinkSync(file.path);
      res.status(400).json({ success: false, message: 'avatarScale must be between 0.3 and 0.9.' });
      return;
    }

    // Upload PNG to Cloudinary
    const result = await cloudinary.uploader.upload(file.path, {
      folder: 'gobilive_frames',
      resource_type: 'image',
      public_id: `frame_${Date.now()}`,
      overwrite: false,
      format: 'png',
      transformation: [
        { quality: 'auto:best', fetch_format: 'png' },
      ],
    });

    try { fs.unlinkSync(file.path); } catch (_) {}

    const frame = await Frame.create({
      name: name.trim(),
      imageUrl: result.secure_url,
      thumbnailUrl: result.secure_url,
      price: parsedPrice,
      avatarScale: parsedScale,
      category: (category ?? 'standard').trim(),
      isActive: true,
      sortOrder: Number(sortOrder ?? 0),
    });

    await logActivity({
      actorId: req.adminUser!.id,
      actorRole: req.adminUser!.role,
      actionType: 'create_frame',
      targetEntityType: 'Frame',
      targetEntityId: (frame._id as any).toString(),
      description: `Uploaded avatar frame "${frame.name}" (price: ${frame.price} beans)`,
    });

    res.status(201).json({ success: true, frame });
  } catch (err: any) {
    if ((req as any).file?.path) {
      try { fs.unlinkSync((req as any).file.path); } catch (_) {}
    }
    console.error('[uploadFrame]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PATCH /api/frames/admin/:id  — update frame metadata ───────────────────
export const updateFrame = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const allowed = ['name', 'price', 'avatarScale', 'category', 'isActive', 'sortOrder'];
    const updates: Record<string, any> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (updates.avatarScale !== undefined) {
      const scale = Number(updates.avatarScale);
      if (isNaN(scale) || scale < 0.3 || scale > 0.9) {
        res.status(400).json({ success: false, message: 'avatarScale must be between 0.3 and 0.9.' });
        return;
      }
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid frame ID.' });
      return;
    }

    const frame = await Frame.findByIdAndUpdate(id, updates, { new: true });
    if (!frame) {
      res.status(404).json({ success: false, message: 'Frame not found.' });
      return;
    }
    res.status(200).json({ success: true, frame });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── DELETE /api/frames/admin/:id  — delete frame (admin only) ───────────────
export const deleteFrame = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid frame ID.' });
      return;
    }
    const frame = await Frame.findByIdAndDelete(id);
    if (!frame) {
      res.status(404).json({ success: false, message: 'Frame not found.' });
      return;
    }
    res.status(200).json({ success: true, message: 'Frame deleted.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /api/frames/purchase/:id  — user purchases a frame with Beans ──────
export const purchaseFrame = async (req: AuthRequest, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const id = String(req.params.id);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid frame ID.' });
      return;
    }

    const frame = await Frame.findById(id).lean();
    if (!frame || !frame.isActive) {
      res.status(404).json({ success: false, message: 'Frame not found or inactive.' });
      return;
    }

    // Check if user already owns this frame
    const user = await User.findById(req.user.id)
      .select('beanWallet purchasedFrames activeFrameId username')
      .session(session);

    if (!user) {
      await session.abortTransaction();
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    const purchasedFrames: string[] = (user as any).purchasedFrames ?? [];
    const frameIdStr = (frame._id as any).toString();

    if (purchasedFrames.includes(frameIdStr)) {
      await session.abortTransaction();
      res.status(400).json({ success: false, message: 'You already own this frame.' });
      return;
    }

    // Check balance
    if ((user.beanWallet ?? 0) < frame.price) {
      await session.abortTransaction();
      res.status(400).json({ success: false, message: 'Insufficient Beans balance.' });
      return;
    }

    // Deduct beans + add frame to user's collection
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      {
        $inc: { beanWallet: -frame.price },
        $addToSet: { purchasedFrames: frameIdStr },
      },
      { new: true, session }
    ).select('beanWallet purchasedFrames activeFrameId');

    // Increment frame purchase count
    await Frame.findByIdAndUpdate(id, { $inc: { purchaseCount: 1 } }, { session });

    await session.commitTransaction();

    await logActivity({
      actorId: req.user.id,
      actorRole: (req.user as any).role ?? 'user',
      actionType: 'purchase_frame',
      targetEntityType: 'Frame',
      targetEntityId: frameIdStr,
      description: `User @${(user as any).username} purchased frame "${frame.name}" for ${frame.price} beans`,
    });

    res.status(200).json({
      success: true,
      message: `Frame "${frame.name}" purchased successfully!`,
      frame: {
        id: frameIdStr,
        name: frame.name,
        imageUrl: frame.imageUrl,
        avatarScale: frame.avatarScale,
      },
      beanWallet: updatedUser?.beanWallet ?? 0,
      purchasedFrames: updatedUser?.purchasedFrames ?? [],
    });
  } catch (err: any) {
    await session.abortTransaction();
    console.error('[purchaseFrame]', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
};

// ─── POST /api/frames/activate/:id  — user activates a purchased frame ───────
export const activateFrame = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const id = String(req.params.id);

    // Allow deactivating (passing 'none' removes active frame)
    if (id === 'none') {
      await User.findByIdAndUpdate(req.user.id, { activeFrameId: null });
      res.status(200).json({ success: true, message: 'Frame removed.', activeFrameId: null });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid frame ID.' });
      return;
    }

    const user = await User.findById(req.user.id).select('purchasedFrames').lean();
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    const purchasedFrames: string[] = (user as any).purchasedFrames ?? [];
    if (!purchasedFrames.includes(id)) {
      res.status(403).json({ success: false, message: 'You do not own this frame.' });
      return;
    }

    // Verify frame still exists
    const frame = await Frame.findById(id).lean();
    if (!frame) {
      res.status(404).json({ success: false, message: 'Frame not found.' });
      return;
    }

    await User.findByIdAndUpdate(req.user.id, { activeFrameId: id });

    res.status(200).json({
      success: true,
      message: `Frame "${frame.name}" is now active!`,
      activeFrameId: id,
      frame: {
        id,
        name: frame.name,
        imageUrl: frame.imageUrl,
        avatarScale: frame.avatarScale,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /api/frames/my  — user's purchased frames + active frame ────────────
export const getMyFrames = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const user = await User.findById(req.user.id)
      .select('purchasedFrames activeFrameId beanWallet')
      .lean();

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    const purchasedFrames: string[] = (user as any).purchasedFrames ?? [];
    const activeFrameId: string | null = (user as any).activeFrameId ?? null;

    // Fetch full frame data for owned frames
    const ownedFrames = purchasedFrames.length > 0
      ? await Frame.find({ _id: { $in: purchasedFrames } }).lean()
      : [];

    let activeFrame = null;
    if (activeFrameId) {
      activeFrame = ownedFrames.find(
        (f) => (f._id as any).toString() === activeFrameId
      ) ?? null;
    }

    res.status(200).json({
      success: true,
      ownedFrames,
      activeFrameId,
      activeFrame,
      beanWallet: (user as any).beanWallet ?? 0,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
