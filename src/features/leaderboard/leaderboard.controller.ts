import { Response } from 'express';
import { User } from '../auth/user.model';
import { AuthRequest } from '../../core/middlewares/auth.middleware';

export const getRichest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
    const skip = (page - 1) * limit;

    const users = await User.find({ isSuspended: false, isTerminated: false, isBlocked: false })
      .sort({ diamonds: -1 })
      .skip(skip)
      .limit(limit)
      .select('_id username profilePic level isVIP diamonds')
      .lean();

    const data = users.map((u: any) => ({
      userId: String(u._id),
      username: u.username,
      profilePic: u.profilePic ?? '',
      level: u.level ?? 1,
      isVIP: u.isVIP ?? false,
      diamonds: u.diamonds ?? 0,
    }));

    res.status(200).json({ success: true, data, page, limit });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTopHosts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
    const skip = (page - 1) * limit;

    const users = await User.find({ isSuspended: false, isTerminated: false, isBlocked: false })
      .sort({ rcoins: -1 })
      .skip(skip)
      .limit(limit)
      .select('_id username profilePic level isVIP rcoins')
      .lean();

    const data = users.map((u: any) => ({
      userId: String(u._id),
      username: u.username,
      profilePic: u.profilePic ?? '',
      level: u.level ?? 1,
      isVIP: u.isVIP ?? false,
      rcoins: u.rcoins ?? 0,
    }));

    res.status(200).json({ success: true, data, page, limit });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTopGifters = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
    const skip = (page - 1) * limit;

    const users = await User.find({ isSuspended: false, isTerminated: false, isBlocked: false })
      .sort({ likesCount: -1 })
      .skip(skip)
      .limit(limit)
      .select('_id username profilePic level isVIP likesCount')
      .lean();

    const data = users.map((u: any) => ({
      userId: String(u._id),
      username: u.username,
      profilePic: u.profilePic ?? '',
      level: u.level ?? 1,
      isVIP: u.isVIP ?? false,
      likesCount: u.likesCount ?? 0,
    }));

    res.status(200).json({ success: true, data, page, limit });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
