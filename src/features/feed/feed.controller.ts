import { Response } from 'express';
import { Types } from 'mongoose';
import { Post } from './post.model';
import { Comment } from './comment.model';
import { PostLike } from './post_like.model';
import { PostSave } from './post_save.model';
import { User } from '../auth/user.model';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { createAndSend, NotificationTriggers } from '../notifications/notification.service';

// GET /feed?page=1&limit=10&userId=xxx&likedBy=xxx
export const getFeed = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page  = parseInt(req.query.page  as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip  = (page - 1) * limit;

    const filter: any = { isPublic: true, isArchived: { $ne: true } };

    if (req.query.userId) {
      filter.userId = new Types.ObjectId(req.query.userId as string);
      // Exclude archived posts from public profile view
      filter.isArchived = { $ne: true };
    } else if (req.query.likedBy) {
      // Dynamic liked posts: fetch popular posts with likes
      filter.likesCount = { $gt: 0 };
    }

    const posts = await Post.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'profilePic')
      .lean() as any[];

    const enrichedPosts = posts.map(post => {
      const p = { ...post };
      if (post.userId && typeof post.userId === 'object') {
        p.userProfilePic = post.userId.profilePic || post.userProfilePic;
        p.userId = post.userId._id;
      }
      return p;
    });

    // Attach isLiked + isSaved for current user
    if (req.user && enrichedPosts.length > 0) {
      const postIds = enrichedPosts.map(p => new Types.ObjectId(p._id ?? p.id));
      const userId = new Types.ObjectId(req.user.id);

      const [likes, saves] = await Promise.all([
        PostLike.find({ userId, postId: { $in: postIds } }).select('postId').lean(),
        PostSave.find({ userId, postId: { $in: postIds } }).select('postId').lean(),
      ]);

      const likedSet = new Set(likes.map(l => String(l.postId)));
      const savedSet = new Set(saves.map(s => String(s.postId)));

      for (const p of enrichedPosts) {
        const pid = String(p._id ?? p.id);
        p.isLiked = likedSet.has(pid);
        p.isSaved = savedSet.has(pid);
      }
    }

    const total = await Post.countDocuments(filter);

    res.status(200).json({
      success: true,
      posts: enrichedPosts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /feed  (create post)
export const createPost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const {
      videoUrl,
      imageUrls,
      thumbnailUrl,
      blurHash,
      aspectRatio,
      caption,
      tags,
      duration,
      isPublic,
      postType,
      location,
      allowComments,
    } = req.body;

    const hasVideo = !!videoUrl;
    const hasImages = Array.isArray(imageUrls) && imageUrls.length > 0;
    if (!hasVideo && !hasImages) {
      res.status(400).json({ success: false, message: 'videoUrl or imageUrls required' });
      return;
    }

    const user = await User.findById(req.user.id).select('username profilePic');
    if (!user)   { res.status(404).json({ success: false, message: 'User not found' }); return; }

    const resolvedType = postType || (hasVideo ? 'video' : 'image');

    const post = await Post.create({
      userId:         new Types.ObjectId(req.user.id),
      username:       user.username,
      userProfilePic: user.profilePic,
      postType:       resolvedType,
      videoUrl:       videoUrl || '',
      imageUrls:      hasImages ? imageUrls : [],
      thumbnailUrl:   thumbnailUrl || (hasImages ? imageUrls[0] : ''),
      blurHash:       blurHash || '',
      aspectRatio:    aspectRatio != null ? Number(aspectRatio) : 0.5625,
      caption:        caption      || '',
      tags:           tags         || [],
      duration:       duration     || 0,
      isPublic:       isPublic !== false,
      location:       location || '',
      allowComments:  allowComments !== false,
    });

    res.status(201).json({ success: true, post });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /feed/:id/like
export const likePost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const postId = new Types.ObjectId(req.params.id as string);
    const userId = new Types.ObjectId(req.user.id);

    const postExists = await Post.findById(postId).select('_id likesCount');
    if (!postExists) { res.status(404).json({ success: false, message: 'Post not found' }); return; }

    const existing = await PostLike.findOne({ postId, userId }).select('_id');

    let isLiked = false;
    let updated: any;
    if (existing) {
      await PostLike.deleteOne({ _id: existing._id });
      updated = await Post.findByIdAndUpdate(
        postId,
        { $inc: { likesCount: -1 } },
        { new: true }
      ).select('likesCount userId');
      // Safety clamp (in case of data mismatch)
      if (updated && updated.likesCount < 0) {
        updated.likesCount = 0;
        await updated.save();
      }
      // Decrement post owner's total likes count
      if (updated?.userId) {
        await User.findByIdAndUpdate(updated.userId, { $inc: { likesCount: -1 } });
      }
      isLiked = false;
    } else {
      // Unique index prevents multi-likes even if client spams the button quickly
      try {
        await PostLike.create({ postId, userId });
        updated = await Post.findByIdAndUpdate(
          postId,
          { $inc: { likesCount: 1 } },
          { new: true }
        ).select('likesCount userId');
        // Increment post owner's total likes count
        if (updated?.userId) {
          await User.findByIdAndUpdate(updated.userId, { $inc: { likesCount: 1 } });
        }
        isLiked = true;

        // ── Notify post owner (skip self-likes) ──
        const ownerId = updated?.userId?.toString();
        if (ownerId && ownerId !== req.user!.id) {
          const actor = await User.findById(req.user!.id).select('username profilePic').lean();
          createAndSend({
            recipientId: ownerId,
            actorId: req.user!.id,
            actorUsername: actor?.username ?? req.user!.username,
            actorProfilePic: actor?.profilePic ?? '',
            type: 'post_like',
            payload: NotificationTriggers.postLiked(actor?.username ?? req.user!.username),
            referenceId: String(postId),
          }).catch(() => {}); // fire-and-forget
        }
      } catch (e: any) {
        // In case of race condition: treat as already liked
        const stillExists = await PostLike.findOne({ postId, userId }).select('_id');
        isLiked = !!stillExists;
        updated = await Post.findById(postId).select('likesCount userId');
      }
    }

    res.status(200).json({ success: true, likesCount: updated?.likesCount ?? 0, isLiked });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /feed/:id/comments
export const getComments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const comments = await Comment.find({ postId: new Types.ObjectId(req.params.id as string) })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('userId', 'profilePic')
      .lean() as any[];

    const enrichedComments = comments.map(comment => {
      const c = { ...comment };
      if (comment.userId && typeof comment.userId === 'object') {
        c.userProfilePic = comment.userId.profilePic || comment.userProfilePic;
        c.userId = comment.userId._id;
      }
      return c;
    });

    res.status(200).json({ success: true, comments: enrichedComments });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /feed/:id/share
export const sharePost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const post = await Post.findByIdAndUpdate(
      new Types.ObjectId(req.params.id as string),
      { $inc: { sharesCount: 1 } },
      { new: true }
    );
    if (!post) {
      res.status(404).json({ success: false, message: 'Post not found' });
      return;
    }
    res.status(200).json({ success: true, sharesCount: post.sharesCount });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /feed/:id/view
// Simple view counter: increments viewsCount by 1 per request.
export const viewPost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const post = await Post.findByIdAndUpdate(
      new Types.ObjectId(req.params.id as string),
      { $inc: { viewsCount: 1 } },
      { new: true }
    );
    if (!post) {
      res.status(404).json({ success: false, message: 'Post not found' });
      return;
    }
    res.status(200).json({ success: true, viewsCount: post.viewsCount });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /feed/:id/comments
export const addComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const { text } = req.body;
    if (!text) { res.status(400).json({ success: false, message: 'text is required' }); return; }

    const user = await User.findById(req.user.id).select('username profilePic');
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }

    const comment = await Comment.create({
      postId:         new Types.ObjectId(req.params.id as string),
      userId:         new Types.ObjectId(req.user.id),
      username:       user.username,
      userProfilePic: user.profilePic,
      text,
    });

    await Post.findByIdAndUpdate(new Types.ObjectId(req.params.id as string), { $inc: { commentsCount: 1 } });

    // ── Notify post owner (skip self-comments) ──
    const parentPost = await Post.findById(req.params.id).select('userId').lean();
    const ownerId = parentPost?.userId?.toString();
    if (ownerId && ownerId !== req.user.id) {
      createAndSend({
        recipientId: ownerId,
        actorId: req.user.id,
        actorUsername: user.username,
        actorProfilePic: user.profilePic ?? '',
        type: 'post_comment',
        payload: NotificationTriggers.postCommented(user.username, text),
        referenceId: req.params.id as string,
      }).catch(() => {});
    }

    res.status(201).json({ success: true, comment });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /feed/:id  — permanently delete own post
export const deletePost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const post = await Post.findById(req.params.id);
    if (!post) { res.status(404).json({ success: false, message: 'Post not found' }); return; }

    if (String(post.userId) !== String(req.user.id)) {
      res.status(403).json({ success: false, message: 'Forbidden: not your post' });
      return;
    }

    await Post.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Post deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /feed/:id/archive  — archive own post (hide from profile)
export const archivePost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const post = await Post.findById(req.params.id);
    if (!post) { res.status(404).json({ success: false, message: 'Post not found' }); return; }

    if (String(post.userId) !== String(req.user.id)) {
      res.status(403).json({ success: false, message: 'Forbidden: not your post' });
      return;
    }

    post.isArchived = true;
    await post.save();

    res.status(200).json({ success: true, message: 'Post archived', post });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /feed/:id/restore  — restore archived post back to profile
export const restorePost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const post = await Post.findById(req.params.id);
    if (!post) { res.status(404).json({ success: false, message: 'Post not found' }); return; }

    if (String(post.userId) !== String(req.user.id)) {
      res.status(403).json({ success: false, message: 'Forbidden: not your post' });
      return;
    }

    post.isArchived = false;
    await post.save();

    res.status(200).json({ success: true, message: 'Post restored', post });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /feed/:id  — edit caption / tags / isPublic of own post
export const editPost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const post = await Post.findById(req.params.id);
    if (!post) { res.status(404).json({ success: false, message: 'Post not found' }); return; }

    if (String(post.userId) !== String(req.user.id)) {
      res.status(403).json({ success: false, message: 'Forbidden: not your post' });
      return;
    }

    const { caption, tags, isPublic } = req.body;

    if (caption !== undefined) post.caption  = caption;
    if (tags    !== undefined) post.tags     = tags;
    if (isPublic !== undefined) post.isPublic = isPublic;

    await post.save();

    res.status(200).json({ success: true, post });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /feed/archived  — get current user's archived posts
export const getArchivedPosts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const page  = parseInt(req.query.page  as string) || 1;
    const limit = parseInt(req.query.limit as string) || 30;
    const skip  = (page - 1) * limit;

    const posts = await Post.find({
      userId:     new Types.ObjectId(req.user.id),
      isArchived: true,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Post.countDocuments({
      userId:     new Types.ObjectId(req.user.id),
      isArchived: true,
    });

    res.status(200).json({ success: true, posts, pagination: { page, limit, total } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /feed/:id/save  — toggle save/unsave a post
export const savePost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const postId = new Types.ObjectId(req.params.id as string);
    const userId = new Types.ObjectId(req.user.id);

    const existing = await PostSave.findOne({ postId, userId });
    let isSaved: boolean;

    if (existing) {
      await PostSave.deleteOne({ _id: existing._id });
      isSaved = false;
    } else {
      await PostSave.create({ postId, userId });
      isSaved = true;

      // ── Notify post owner (skip self-saves) ──
      const savedPost = await Post.findById(postId).select('userId').lean();
      const ownerId = savedPost?.userId?.toString();
      if (ownerId && ownerId !== req.user!.id) {
        const actor = await User.findById(req.user!.id).select('username profilePic').lean();
        createAndSend({
          recipientId: ownerId,
          actorId: req.user!.id,
          actorUsername: actor?.username ?? '',
          actorProfilePic: actor?.profilePic ?? '',
          type: 'post_save',
          payload: NotificationTriggers.postSaved(actor?.username ?? ''),
          referenceId: String(postId),
        }).catch(() => {});
      }
    }

    res.status(200).json({ success: true, isSaved });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /feed/saved  — get current user's saved posts
export const getSavedPosts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const page  = parseInt(req.query.page  as string) || 1;
    const limit = parseInt(req.query.limit as string) || 30;
    const skip  = (page - 1) * limit;

    const saves = await PostSave.find({ userId: new Types.ObjectId(req.user.id) })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('postId')
      .lean();

    const postIds = saves.map(s => s.postId);
    const posts = await Post.find({ _id: { $in: postIds }, isArchived: { $ne: true } }).lean();

    // Preserve save order
    const postMap = new Map(posts.map(p => [String(p._id), { ...p, isSaved: true }]));
    const orderedPosts = postIds.map(id => postMap.get(String(id))).filter(Boolean);

    res.status(200).json({ success: true, posts: orderedPosts });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
