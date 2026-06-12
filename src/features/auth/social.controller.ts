import { Response } from 'express';
import { User } from './user.model';
import { Follow } from './follow.model';
import { AuthRequest } from '../../core/middlewares/auth.middleware';

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const { bio, profilePic, age, gender, thought, payoutMethod, payoutDetails, bankName, bankAccountNumber, bankAccountHolder } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    if (bio !== undefined) user.bio = bio;
    if (profilePic !== undefined) user.profilePic = profilePic;
    if (age !== undefined) user.age = age;
    if (gender !== undefined) user.gender = gender;
    if (thought !== undefined) {
      user.thought = thought;
      user.thoughtUpdatedAt = new Date();
    }
    if (payoutMethod !== undefined) user.payoutMethod = payoutMethod;
    if (payoutDetails !== undefined) user.payoutDetails = payoutDetails;
    if (bankName !== undefined) user.bankName = bankName;
    if (bankAccountNumber !== undefined) user.bankAccountNumber = bankAccountNumber;
    if (bankAccountHolder !== undefined) user.bankAccountHolder = bankAccountHolder;

    await user.save();

    res.status(200).json({ success: true, user: await User.findById(user.id).select('-passwordHash') });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.userId).select('-passwordHash -fcmTokens');
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    // If the viewer has blocked the target OR the target has blocked the viewer,
    // return a 403 so the profile is hidden.
    if (req.user) {
      const viewerId = req.user.id;
      const targetBlockedViewer = (user.blockedUsers as any[])?.some(
        (id: any) => String(id) === String(viewerId)
      );
      const viewerBlockedTarget = await User.findById(viewerId)
        .select('blockedUsers')
        .lean() as any;
      const viewerHasBlocked = (viewerBlockedTarget?.blockedUsers as any[])?.some(
        (id: any) => String(id) === String(user._id)
      );

      if (targetBlockedViewer || viewerHasBlocked) {
        res.status(403).json({
          success: false,
          message: 'This profile is not available.',
          isBlocked: true,
        });
        return;
      }
    }

    let isFollowing = false;
    let isBlockedByMe = false;
    if (req.user) {
      const follow = await Follow.findOne({
        followerId: req.user.id,
        followingId: user.id,
      });
      isFollowing = !!follow;

      const me = await User.findById(req.user.id).select('blockedUsers').lean() as any;
      isBlockedByMe = (me?.blockedUsers as any[])?.some(
        (id: any) => String(id) === String(user._id)
      ) ?? false;
    }

    res.status(200).json({ success: true, user, isFollowing, isBlockedByMe });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getFollowers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = String(req.params.userId);
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
    const skip = (page - 1) * limit;

    const total = await Follow.countDocuments({ followingId: userId });

    const rows = await Follow.find({ followingId: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(
        'followerId',
        'username bio profilePic level isVIP vipFrame badges followersCount followingCount likesCount'
      )
      .lean();

    const users = rows
      .map((r: any) => r.followerId)
      .filter(Boolean);

    res.status(200).json({ success: true, users, page, limit, total });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getFollowing = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = String(req.params.userId);
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
    const skip = (page - 1) * limit;

    const total = await Follow.countDocuments({ followerId: userId });

    const rows = await Follow.find({ followerId: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(
        'followingId',
        'username bio profilePic level isVIP vipFrame badges followersCount followingCount likesCount thought thoughtUpdatedAt'
      )
      .lean();

    const users = rows
      .map((r: any) => r.followingId)
      .filter(Boolean);

    res.status(200).json({ success: true, users, page, limit, total });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const followUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const targetId = String(req.params.userId);
    if (targetId === req.user.id) {
      res.status(400).json({ success: false, message: 'Cannot follow yourself.' });
      return;
    }

    const target = await User.findById(targetId);
    if (!target) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    const existing = await Follow.findOne({ followerId: req.user.id, followingId: targetId });
    if (existing) {
      res.status(400).json({ success: false, message: 'Already following.' });
      return;
    }

    await Follow.create({ followerId: req.user.id, followingId: targetId });
    await User.findByIdAndUpdate(req.user.id, { $inc: { followingCount: 1 } });
    await User.findByIdAndUpdate(targetId, { $inc: { followersCount: 1 } });

    res.status(200).json({ success: true, message: 'Followed successfully.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const unfollowUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const targetId = String(req.params.userId);
    const removed = await Follow.findOneAndDelete({
      followerId: req.user.id,
      followingId: targetId,
    });

    if (!removed) {
      res.status(400).json({ success: false, message: 'Not following this user.' });
      return;
    }

    await User.findByIdAndUpdate(req.user.id, { $inc: { followingCount: -1 } });
    await User.findByIdAndUpdate(targetId, { $inc: { followersCount: -1 } });

    res.status(200).json({ success: true, message: 'Unfollowed successfully.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateNotificationPrefs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    user.notificationPrefs = { ...user.notificationPrefs, ...req.body };
    await user.save();

    res.status(200).json({ success: true, notificationPrefs: user.notificationPrefs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const blockUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const { userId } = req.params;

    if (userId === req.user.id) {
      res.status(400).json({ success: false, message: 'Cannot block yourself.' });
      return;
    }

    await User.findByIdAndUpdate(req.user.id, { $addToSet: { blockedUsers: userId } });

    // Also remove any existing follow relationship in both directions
    await Follow.findOneAndDelete({ followerId: req.user.id, followingId: userId });
    await Follow.findOneAndDelete({ followerId: userId, followingId: req.user.id });
    // Decrement counts accordingly (best-effort, ignore if follow didn't exist)
    await User.findByIdAndUpdate(req.user.id,  { $inc: { followingCount: -1 } }).catch(() => {});
    await User.findByIdAndUpdate(userId,        { $inc: { followersCount: -1 } }).catch(() => {});
    await User.findByIdAndUpdate(userId,        { $inc: { followingCount: -1 } }).catch(() => {});
    await User.findByIdAndUpdate(req.user.id,   { $inc: { followersCount: -1 } }).catch(() => {});

    res.status(200).json({ success: true, message: 'User blocked.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const unblockUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const { userId } = req.params;
    await User.findByIdAndUpdate(req.user.id, { $pull: { blockedUsers: userId } });
    res.status(200).json({ success: true, message: 'User unblocked.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getBlockedUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const me = await User.findById(req.user.id).select('blockedUsers').lean();
    const blockedIds = (me?.blockedUsers as any[]) ?? [];

    if (blockedIds.length === 0) {
      res.status(200).json({ success: true, users: [] });
      return;
    }

    const users = await User.find({ _id: { $in: blockedIds } })
      .select('username profilePic bio isVIP')
      .lean();

    res.status(200).json({ success: true, users });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
