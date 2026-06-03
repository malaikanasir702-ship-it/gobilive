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

    let isFollowing = false;
    if (req.user) {
      const follow = await Follow.findOne({
        followerId: req.user.id,
        followingId: user.id,
      });
      isFollowing = !!follow;
    }

    res.status(200).json({ success: true, user, isFollowing });
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
    await User.findByIdAndUpdate(req.user.id, { $addToSet: { blockedUsers: userId } });
    res.status(200).json({ success: true, message: 'User blocked.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
