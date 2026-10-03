import { Response } from 'express';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import {
  getActivityFeed,
  markActivityRead,
  markAllActivitiesRead,
  getActivityUnreadCount,
  ActivityFilter,
} from './activity.service';
import { User } from '../auth/user.model';

// GET /api/activity?filter=all&page=1&limit=20
export const getActivities = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const recipientId = req.user.id;
    const filter = (req.query.filter as ActivityFilter) || 'all';
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

    const validFilters: ActivityFilter[] = [
      'all', 'likes_favorites', 'comments', 'mentions_tags', 'new_followers', 'profile_views',
    ];
    if (!validFilters.includes(filter)) {
      res.status(400).json({ success: false, message: 'Invalid filter.' });
      return;
    }

    const result = await getActivityFeed({ recipientId, filter, page, limit });
    res.status(200).json({ success: true, ...result });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// GET /api/activity/unread-count
export const getUnreadCount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }
    const count = await getActivityUnreadCount(req.user.id);
    res.status(200).json({ success: true, unreadCount: count });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// PATCH /api/activity/read-all
export const markAllRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }
    await markAllActivitiesRead(req.user.id);
    res.status(200).json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// PATCH /api/activity/:id/read
export const markOneRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }
    await markActivityRead(req.user.id, String(req.params.id));
    res.status(200).json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// POST /api/activity/profile-view/:userId  — User A views User B's profile
// User B's activity is created only if their privacy setting allows it.
export const recordProfileView = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const viewedUserId = String(req.params.userId);
    const viewerId = String(req.user.id);

    if (viewedUserId === viewerId) {
      res.status(200).json({ success: true, message: 'Self-view ignored.' });
      return;
    }

    // Check viewed user's privacy preference
    const viewedUser = await User.findById(viewedUserId)
      .select('profileViewsVisible isTerminated isBlocked')
      .lean() as any;

    if (!viewedUser || viewedUser.isTerminated || viewedUser.isBlocked) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    // Default: profile views visible unless explicitly disabled
    const canSeeViews = viewedUser.profileViewsVisible !== false;
    if (!canSeeViews) {
      res.status(200).json({ success: true, message: 'Profile view not recorded (privacy setting).' });
      return;
    }

    // Create the activity (service applies blocking + idempotency)
    const { createActivity } = await import('./activity.service');
    await createActivity({
      recipientId: viewedUserId,
      actorId: viewerId,
      type: 'profile_view',
    });

    res.status(200).json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// GET /api/activity/privacy-settings
export const getPrivacySettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }
    const user = await User.findById(req.user.id).select('profileViewsVisible').lean() as any;
    res.status(200).json({
      success: true,
      profileViewsVisible: user?.profileViewsVisible !== false,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// PATCH /api/activity/privacy-settings
export const updatePrivacySettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }
    const { profileViewsVisible } = req.body;
    if (typeof profileViewsVisible !== 'boolean') {
      res.status(400).json({ success: false, message: 'profileViewsVisible must be a boolean.' });
      return;
    }
    await User.findByIdAndUpdate(req.user.id, { $set: { profileViewsVisible } });
    res.status(200).json({ success: true, profileViewsVisible });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};
