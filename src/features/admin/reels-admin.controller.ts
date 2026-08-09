import { Response } from 'express';
import { Types } from 'mongoose';
import { Post } from '../feed/post.model';
import { User } from '../auth/user.model';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { createAndSend } from '../notifications/notification.service';

// GET /api/admin/reels?tab=all|reported|deleted|appealed&search=xxx&page=1&limit=20
export const listReels = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page   = parseInt(req.query.page  as string) || 1;
    const limit  = parseInt(req.query.limit as string) || 20;
    const skip   = (page - 1) * limit;
    const tab    = (req.query.tab as string) || 'all';
    const search = (req.query.search as string) || '';

    const filter: any = {};

    if (tab === 'reported') {
      filter.reportedCount = { $gt: 0 };
      filter.isDeleted = false;
    } else if (tab === 'deleted') {
      filter.isDeleted = true;
    } else if (tab === 'appealed') {
      filter.appealStatus = { $in: ['pending', 'accepted', 'rejected'] };
    }

    if (search.trim()) {
      filter.$or = [
        { caption: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
      ];
    }

    const posts = await Post.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'username profilePic roles role email')
      .populate('reports.userId', 'username profilePic')
      .lean();

    const total = await Post.countDocuments(filter);

    res.status(200).json({
      success: true,
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/admin/reels/:id — Delete/restrict reel with reason category & notification
export const deleteReelByAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { reasonCategory, reasonNote } = req.body;
    if (!reasonCategory) {
      res.status(400).json({ success: false, message: 'reasonCategory is required' });
      return;
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      res.status(404).json({ success: false, message: 'Reel not found' });
      return;
    }

    post.isDeleted = true;
    post.deletedAt = new Date();
    post.deletionCategory = reasonCategory;
    post.deletionReason = reasonNote || '';
    post.appealStatus = 'none'; // reset appeal status if newly deleted

    await post.save();

    // Send notification to the creator
    const ownerId = post.userId.toString();
    const reasonText = reasonNote ? `${reasonCategory} (${reasonNote})` : reasonCategory;

    createAndSend({
      recipientId: ownerId,
      actorId: req.user?.id || ownerId,
      actorUsername: 'Company Admin',
      actorProfilePic: '',
      type: 'system',
      payload: {
        title: '⚠️ Reel Removed',
        body: `Your video was removed by Company Admin for violating guidelines: "${reasonText}". You may appeal this decision from your profile.`,
        data: { postId: String(post._id), action: 'reel_deleted', reasonCategory, reasonNote },
      },
      referenceId: String(post._id),
    }).catch(() => {});

    res.status(200).json({
      success: true,
      message: 'Reel deleted successfully. Creator has been notified.',
      post,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/admin/reels/:id/appeal-decision — Approve (restore) or Reject appeal
export const handleAppealDecision = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { action, note } = req.body; // action: 'approve' | 'reject'
    if (!action || !['approve', 'reject'].includes(action)) {
      res.status(400).json({ success: false, message: 'Action must be approve or reject' });
      return;
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      res.status(404).json({ success: false, message: 'Reel not found' });
      return;
    }

    const ownerId = post.userId.toString();

    if (action === 'approve') {
      post.isDeleted = false;
      post.appealStatus = 'accepted';
      await post.save();

      createAndSend({
        recipientId: ownerId,
        actorId: req.user?.id || ownerId,
        actorUsername: 'Company Admin',
        actorProfilePic: '',
        type: 'system',
        payload: {
          title: '✅ Appeal Approved',
          body: 'Your appeal was reviewed and approved by Company Admin! Your video has been restored to public view.',
          data: { postId: String(post._id), action: 'appeal_approved' },
        },
        referenceId: String(post._id),
      }).catch(() => {});

      res.status(200).json({ success: true, message: 'Appeal approved. Reel restored successfully.', post });
    } else {
      post.appealStatus = 'rejected';
      await post.save();

      createAndSend({
        recipientId: ownerId,
        actorId: req.user?.id || ownerId,
        actorUsername: 'Company Admin',
        actorProfilePic: '',
        type: 'system',
        payload: {
          title: '❌ Appeal Rejected',
          body: `Your appeal for video restoration was reviewed and rejected. ${note ? `Reason: ${note}` : ''}`,
          data: { postId: String(post._id), action: 'appeal_rejected' },
        },
        referenceId: String(post._id),
      }).catch(() => {});

      res.status(200).json({ success: true, message: 'Appeal rejected.', post });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
