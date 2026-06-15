import { Response } from 'express';
import { Types } from 'mongoose';
import { Story } from './story.model';
import { User } from '../auth/user.model';
import { Follow } from '../auth/follow.model';
import { AuthRequest } from '../../core/middlewares/auth.middleware';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/story — Create a new story
// ─────────────────────────────────────────────────────────────────────────────
export const createStory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { mediaUrl, mediaType } = req.body;
    if (!mediaUrl) {
      res.status(400).json({ success: false, message: 'mediaUrl is required.' });
      return;
    }

    const user = await User.findById(req.user!.id).select('username profilePic').lean() as any;
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    const story = await Story.create({
      userId: new Types.ObjectId(req.user!.id),
      username: user.username,
      userProfilePic: user.profilePic || '',
      mediaUrl,
      mediaType: mediaType || 'image',
    });

    res.status(201).json({ success: true, story });
  } catch (error: any) {
    console.error('createStory error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create story.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/story/mine — Get current user's active (non-expired) stories
// ─────────────────────────────────────────────────────────────────────────────
export const getMyStories = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const stories = await Story.find({
      userId: new Types.ObjectId(req.user!.id),
      createdAt: { $gte: twentyFourHoursAgo },
    })
      .sort({ createdAt: 1 })
      .lean();

    res.status(200).json({ success: true, stories });
  } catch (error: any) {
    console.error('getMyStories error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch stories.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/story/user/:userId — Get target user's stories (with privacy filter)
// ─────────────────────────────────────────────────────────────────────────────
export const getUserStories = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.params.userId as string;
    if (!userId) {
      res.status(400).json({ success: false, message: 'userId is required.' });
      return;
    }

    const targetUser = await User.findById(userId).select('storyPrivacy').lean() as any;
    if (!targetUser) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    // Check privacy visibility
    const viewerId = req.user?.id;
    const targetId = userId;

    // Owner can always see own stories
    if (viewerId !== targetId) {
      const privacy: string = targetUser.storyPrivacy || 'everyone';

      if (privacy === 'followers') {
        // Viewer must be in target user's followers
        const isFollower = await Follow.findOne({
          followerId: new Types.ObjectId(viewerId),
          followingId: new Types.ObjectId(targetId),
        }).select('_id').lean();
        if (!isFollower) {
          res.status(200).json({ success: true, stories: [] });
          return;
        }
      } else if (privacy === 'following') {
        // Viewer must be someone the target user follows back
        const isFollowingBack = await Follow.findOne({
          followerId: new Types.ObjectId(targetId),
          followingId: new Types.ObjectId(viewerId),
        }).select('_id').lean();
        if (!isFollowingBack) {
          res.status(200).json({ success: true, stories: [] });
          return;
        }
      }
      // 'everyone' — no filter needed
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const stories = await Story.find({
      userId: new Types.ObjectId(userId),
      createdAt: { $gte: twentyFourHoursAgo },
    })
      .sort({ createdAt: 1 })
      .lean();

    res.status(200).json({ success: true, stories });
  } catch (error: any) {
    console.error('getUserStories error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch stories.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/story/feed — Aggregated story groups from followed users + self
// ─────────────────────────────────────────────────────────────────────────────
export const getStoriesFeed = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const viewerId = new Types.ObjectId(req.user!.id);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get list of users the current user follows
    const follows = await Follow.find({ followerId: viewerId }).select('followingId').lean();
    const followingIds = follows.map(f => f.followingId);

    // Always include own stories
    const userIdsToFetch = [viewerId, ...followingIds.filter(id => !id.equals(viewerId))];

    // Fetch all active stories for these users
    const stories = await Story.find({
      userId: { $in: userIdsToFetch },
      createdAt: { $gte: twentyFourHoursAgo },
    })
      .sort({ createdAt: -1 })
      .lean() as any[];

    // Group by userId
    const groupMap = new Map<string, any>();
    for (const story of stories) {
      const uid = String(story.userId);
      if (!groupMap.has(uid)) {
        groupMap.set(uid, {
          userId: uid,
          username: story.username,
          userProfilePic: story.userProfilePic,
          stories: [],
        });
      }
      groupMap.get(uid)!.stories.push(story);
    }

    // For other users' stories, apply their privacy filters
    const groups = Array.from(groupMap.values());
    const filteredGroups: any[] = [];

    for (const group of groups) {
      // Own stories — always include
      if (group.userId === String(viewerId)) {
        filteredGroups.push(group);
        continue;
      }

      // Check target user's storyPrivacy
      const targetUser = await User.findById(group.userId).select('storyPrivacy').lean() as any;
      const privacy: string = targetUser?.storyPrivacy || 'everyone';

      if (privacy === 'everyone') {
        filteredGroups.push(group);
      } else if (privacy === 'followers') {
        // Viewer must follow target
        const isFollower = await Follow.findOne({
          followerId: viewerId,
          followingId: new Types.ObjectId(group.userId),
        }).select('_id').lean();
        if (isFollower) filteredGroups.push(group);
      } else if (privacy === 'following') {
        // Target must follow viewer back
        const isFollowingBack = await Follow.findOne({
          followerId: new Types.ObjectId(group.userId),
          followingId: viewerId,
        }).select('_id').lean();
        if (isFollowingBack) filteredGroups.push(group);
      }
    }

    res.status(200).json({ success: true, storyGroups: filteredGroups });
  } catch (error: any) {
    console.error('getStoriesFeed error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch story feed.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/story/:id/view — Mark story as viewed by current user (idempotent)
// ─────────────────────────────────────────────────────────────────────────────
export const viewStory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const viewerId = new Types.ObjectId(req.user!.id);

    // Add viewer to viewedByUsers only if not already present (addToSet = idempotent)
    await Story.findByIdAndUpdate(id, {
      $addToSet: { viewedByUsers: viewerId },
    });

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('viewStory error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to record view.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/story/:id/viewers — Get list of users who viewed a specific story
// ─────────────────────────────────────────────────────────────────────────────
export const getStoryViewers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const story = await Story.findById(id)
      .populate('viewedByUsers', 'username profilePic')
      .lean() as any;

    if (!story) {
      res.status(404).json({ success: false, message: 'Story not found.' });
      return;
    }

    // Only the story owner can see who viewed it
    if (String(story.userId) !== req.user!.id) {
      res.status(403).json({ success: false, message: 'Only the story owner can see viewers.' });
      return;
    }

    const viewers = (story.viewedByUsers || []).map((u: any) => ({
      id: u._id,
      username: u.username,
      profilePic: u.profilePic || '',
    }));

    res.status(200).json({ success: true, viewers });
  } catch (error: any) {
    console.error('getStoryViewers error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch viewers.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/story/:id — Delete a story (owner only)
// ─────────────────────────────────────────────────────────────────────────────
export const deleteStory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const story = await Story.findById(id).lean();
    if (!story) {
      res.status(404).json({ success: false, message: 'Story not found.' });
      return;
    }

    if (String(story.userId) !== req.user!.id) {
      res.status(403).json({ success: false, message: 'You can only delete your own stories.' });
      return;
    }

    await Story.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Story deleted.' });
  } catch (error: any) {
    console.error('deleteStory error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to delete story.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/story/privacy — Get current user's story privacy setting
// ─────────────────────────────────────────────────────────────────────────────
export const getStoryPrivacy = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.id).select('storyPrivacy').lean() as any;
    res.status(200).json({
      success: true,
      storyPrivacy: user?.storyPrivacy || 'everyone',
    });
  } catch (error: any) {
    console.error('getStoryPrivacy error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch privacy setting.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/story/privacy — Update current user's story privacy setting
// ─────────────────────────────────────────────────────────────────────────────
export const updateStoryPrivacy = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { storyPrivacy } = req.body;
    const validOptions = ['everyone', 'followers', 'following'];

    if (!validOptions.includes(storyPrivacy)) {
      res.status(400).json({
        success: false,
        message: 'storyPrivacy must be one of: everyone, followers, following',
      });
      return;
    }

    await User.findByIdAndUpdate(req.user!.id, { storyPrivacy });

    res.status(200).json({ success: true, storyPrivacy });
  } catch (error: any) {
    console.error('updateStoryPrivacy error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update privacy.' });
  }
};
