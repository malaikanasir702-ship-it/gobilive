import { Response } from 'express';
import { User } from './user.model';
import { Follow } from './follow.model';
import { FollowRequest } from './follow-request.model';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { createAndSend, NotificationTriggers } from '../notifications/notification.service';

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
    let isFollowRequestPending = false;
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

      // Check if there is a pending follow request from viewer to target
      if (!isFollowing && (user as any).isPrivate) {
        const existingReq = await FollowRequest.findOne({
          fromId: req.user.id,
          toId: user._id,
          status: 'pending',
        }).select('_id');
        isFollowRequestPending = !!existingReq;
      }
    }

    res.status(200).json({ success: true, user, isFollowing, isBlockedByMe, isFollowRequestPending });
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

    const target = await User.findById(targetId).select('username profilePic isPrivate followersCount notificationPrefs');
    if (!target) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    const existing = await Follow.findOne({ followerId: req.user.id, followingId: targetId });
    if (existing) {
      res.status(400).json({ success: false, message: 'Already following.' });
      return;
    }

    const actor = await User.findById(req.user.id).select('username profilePic').lean() as any;

    // ── Private account: send follow request instead of following directly ──
    if (target.isPrivate) {
      // Upsert: if a rejected request exists, re-open it as pending
      const existingReq = await FollowRequest.findOne({ fromId: req.user.id, toId: targetId });
      if (existingReq) {
        if (existingReq.status === 'pending') {
          res.status(400).json({ success: false, message: 'Follow request already sent.', requestSent: true });
          return;
        }
        existingReq.status = 'pending';
        await existingReq.save();
      } else {
        await FollowRequest.create({ fromId: req.user.id, toId: targetId, status: 'pending' });
      }

      // Notify target about the follow request
      if (target.notificationPrefs?.follows !== false) {
        createAndSend({
          recipientId: targetId,
          actorId: req.user.id,
          actorUsername: actor?.username ?? req.user.username,
          actorProfilePic: actor?.profilePic ?? '',
          type: 'follow_request',
          payload: NotificationTriggers.followRequest(actor?.username ?? req.user.username),
          referenceId: req.user.id, // actorId so we can show their profile
        }).catch(() => {});
      }

      res.status(200).json({ success: true, message: 'Follow request sent.', requestSent: true });
      return;
    }

    // ── Public account: follow directly ──
    await Follow.create({ followerId: req.user.id, followingId: targetId });
    await User.findByIdAndUpdate(req.user.id, { $inc: { followingCount: 1 } });
    await User.findByIdAndUpdate(targetId, { $inc: { followersCount: 1 } });

    if (target.notificationPrefs?.follows !== false) {
      createAndSend({
        recipientId: targetId,
        actorId: req.user.id,
        actorUsername: actor?.username ?? req.user.username,
        actorProfilePic: actor?.profilePic ?? '',
        type: 'follow',
        payload: NotificationTriggers.newFollower(actor?.username ?? req.user.username),
        referenceId: req.user.id,
      }).catch(() => {});
    }

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

// ─── Follow Request: Accept ───────────────────────────────────────────────
export const acceptFollowRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized.' }); return; }

    const { requestId } = req.params;
    const request = await FollowRequest.findById(requestId);

    if (!request) { res.status(404).json({ success: false, message: 'Request not found.' }); return; }
    if (String(request.toId) !== req.user.id) {
      res.status(403).json({ success: false, message: 'Not your request.' }); return;
    }
    if (request.status !== 'pending') {
      res.status(400).json({ success: false, message: 'Request is no longer pending.' }); return;
    }

    // Create the actual follow
    const fromId = String(request.fromId);
    const toId   = String(request.toId);

    const alreadyFollowing = await Follow.findOne({ followerId: fromId, followingId: toId });
    if (!alreadyFollowing) {
      await Follow.create({ followerId: fromId, followingId: toId });
      await User.findByIdAndUpdate(fromId, { $inc: { followingCount: 1 } });
      await User.findByIdAndUpdate(toId,   { $inc: { followersCount: 1 } });
    }

    request.status = 'accepted';
    await request.save();

    // Notify the requester that their request was accepted
    const acceptor = await User.findById(toId).select('username profilePic').lean() as any;
    createAndSend({
      recipientId: fromId,
      actorId: toId,
      actorUsername: acceptor?.username ?? '',
      actorProfilePic: acceptor?.profilePic ?? '',
      type: 'follow_request_accepted',
      payload: NotificationTriggers.followRequestAccepted(acceptor?.username ?? ''),
      referenceId: toId,
    }).catch(() => {});

    res.status(200).json({ success: true, message: 'Follow request accepted.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Follow Request: Reject ───────────────────────────────────────────────
export const rejectFollowRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized.' }); return; }

    const { requestId } = req.params;
    const request = await FollowRequest.findById(requestId);

    if (!request) { res.status(404).json({ success: false, message: 'Request not found.' }); return; }
    if (String(request.toId) !== req.user.id) {
      res.status(403).json({ success: false, message: 'Not your request.' }); return;
    }

    request.status = 'rejected';
    await request.save();

    res.status(200).json({ success: true, message: 'Follow request declined.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Follow Request: Cancel (by the sender) ───────────────────────────────
export const cancelFollowRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized.' }); return; }

    const targetId = req.params.userId;
    await FollowRequest.findOneAndDelete({ fromId: req.user.id, toId: targetId, status: 'pending' });

    res.status(200).json({ success: true, message: 'Follow request cancelled.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Get Pending Follow Requests (for the private account owner) ──────────
export const getPendingFollowRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized.' }); return; }

    const requests = await FollowRequest.find({ toId: req.user.id, status: 'pending' })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('fromId', 'username profilePic bio isVIP')
      .lean();

    const mapped = requests.map((r: any) => ({
      requestId: String(r._id),
      user: r.fromId,
      createdAt: r.createdAt,
    }));

    res.status(200).json({ success: true, requests: mapped });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Toggle Private Account ────────────────────────────────────────────────
export const togglePrivateAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized.' }); return; }

    const user = await User.findById(req.user.id);
    if (!user) { res.status(404).json({ success: false, message: 'User not found.' }); return; }

    (user as any).isPrivate = !(user as any).isPrivate;
    await user.save();

    // If switching to public: auto-accept all pending requests
    if (!(user as any).isPrivate) {
      const pendingRequests = await FollowRequest.find({ toId: req.user.id, status: 'pending' });
      for (const req_ of pendingRequests) {
        const fromId = String(req_.fromId);
        const toId   = String(req_.toId);
        const alreadyFollowing = await Follow.findOne({ followerId: fromId, followingId: toId });
        if (!alreadyFollowing) {
          await Follow.create({ followerId: fromId, followingId: toId });
          await User.findByIdAndUpdate(fromId, { $inc: { followingCount: 1 } });
          await User.findByIdAndUpdate(toId,   { $inc: { followersCount: 1 } });
        }
        req_.status = 'accepted';
        await req_.save();
      }
    }

    const safeUser = await User.findById(req.user.id).select('-passwordHash');
    res.status(200).json({
      success: true,
      isPrivate: (user as any).isPrivate,
      message: (user as any).isPrivate ? 'Account set to private.' : 'Account set to public.',
      user: safeUser,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
