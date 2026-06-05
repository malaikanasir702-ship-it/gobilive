import { Response } from 'express';
import { User } from '../auth/user.model';
import WalletTransaction from '../wallet/wallet.transaction.model';
import { Post } from '../feed/post.model';
import LiveRoom from '../live/live.model';
import { logActivity } from '../activity-log/activity-log.service';
import { AdminAuthRequest } from '../../core/middlewares/rbac.middleware';

const BLOCK_DURATIONS_HOURS: Record<string, number> = {
  '2h': 2,
  '3h': 3,
  '5h': 5,
  '1d': 24,
};

// ─── List Users ───────────────────────────────────────────────────────────────

export const listUsers = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
    const search = (req.query.search as string) || '';
    const status = req.query.status as string;
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;

    const filter: any = {
      role: { $in: ['user'] },
    };

    if (search) {
      const re = new RegExp(search, 'i');
      filter.$or = [{ username: re }, { email: re }, { phone: re }];
    }
    if (status === 'active') filter.isSuspended = false;
    if (status === 'suspended') filter.isSuspended = true;
    if (status === 'blocked') filter.isBlocked = true;
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select('username email phone diamonds rcoins isSuspended isBlocked blockedUntil blockType createdAt profilePic role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Get Full User Profile ────────────────────────────────────────────────────

export const getUserProfile = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const user = await User.findById(id)
      .select('-passwordHash -fcmTokens -twoFactorSecret -twoFactorPendingSecret')
      .lean();

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    const [beanTxs, posts, liveRooms] = await Promise.all([
      WalletTransaction.find({ userId: id, currency: 'rcoins' })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      Post.find({ userId: id }).sort({ createdAt: -1 }).limit(20).lean(),
      LiveRoom.find({ hostId: id }).sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    res.status(200).json({
      success: true,
      user,
      beanTransactions: beanTxs,
      posts,
      liveHistory: liveRooms,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Block User ───────────────────────────────────────────────────────────────

export const blockUser = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { type, duration } = req.body; // type: 'permanent' | 'temporary', duration: '2h'|'3h'|'5h'|'1d'

    if (!type || !['permanent', 'temporary'].includes(type)) {
      res.status(400).json({ success: false, message: 'Block type must be permanent or temporary.' });
      return;
    }
    if (type === 'temporary' && !BLOCK_DURATIONS_HOURS[duration]) {
      res.status(400).json({ success: false, message: 'Duration must be 2h, 3h, 5h, or 1d.' });
      return;
    }

    const update: any = { isBlocked: true, blockType: type };
    if (type === 'temporary') {
      const hours = BLOCK_DURATIONS_HOURS[duration];
      update.blockedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
    } else {
      update.$unset = { blockedUntil: 1 };
    }

    const user = await User.findByIdAndUpdate(id, update, { new: true }).select('username isBlocked blockType blockedUntil');
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    await logActivity({
      actorId: req.adminUser!.id,
      actorRole: req.adminUser!.role,
      actionType: 'block_user',
      targetEntityType: 'User',
      targetEntityId: id,
      description: `Blocked user ${user.username} (${type}${type === 'temporary' ? `, ${duration}` : ''})`,
    });

    // End any active streams if permanently blocked
    if (type === 'permanent') {
      await LiveRoom.updateMany({ hostId: id, isActive: true }, { isActive: false });
    }

    res.status(200).json({ success: true, user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Unblock User ─────────────────────────────────────────────────────────────

export const unblockUser = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const user = await User.findByIdAndUpdate(
      id,
      { isBlocked: false, $unset: { blockedUntil: 1, blockType: 1 } },
      { new: true }
    ).select('username isBlocked');

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    await logActivity({
      actorId: req.adminUser!.id,
      actorRole: req.adminUser!.role,
      actionType: 'unblock_user',
      targetEntityType: 'User',
      targetEntityId: id,
      description: `Unblocked user ${user.username}`,
    });

    res.status(200).json({ success: true, user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Suspend User ─────────────────────────────────────────────────────────────

export const suspendUser = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { suspend } = req.body;

    const user = await User.findByIdAndUpdate(
      id,
      { isSuspended: Boolean(suspend) },
      { new: true }
    ).select('username isSuspended');

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    if (suspend) {
      await LiveRoom.updateMany({ hostId: id, isActive: true }, { isActive: false });
    }

    await logActivity({
      actorId: req.adminUser!.id,
      actorRole: req.adminUser!.role,
      actionType: suspend ? 'suspend_user' : 'unsuspend_user',
      targetEntityType: 'User',
      targetEntityId: id,
      description: `${suspend ? 'Suspended' : 'Unsuspended'} user ${user.username}`,
    });

    res.status(200).json({ success: true, user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
