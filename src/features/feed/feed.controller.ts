import { Response } from 'express';
import { Types } from 'mongoose';
import { Post } from './post.model';
import { Comment } from './comment.model';
import { CommentLike } from './comment_like.model';
import { PostLike } from './post_like.model';
import { PostSave } from './post_save.model';
import { User } from '../auth/user.model';
import { Follow } from '../auth/follow.model';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { createAndSend, NotificationTriggers } from '../notifications/notification.service';
import { createActivity, removeActivity } from '../activity/activity.service';

// GET /feed?page=1&limit=10&userId=xxx&likedBy=xxx
export const getFeed = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page  = parseInt(req.query.page  as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip  = (page - 1) * limit;
    const tab   = (req.query.tab as string) || 'forYou';

    const filter: any = { isPublic: { $ne: false }, isArchived: { $ne: true }, isDeleted: { $ne: true } };

    if (req.query.userId) {
      filter.userId = new Types.ObjectId(req.query.userId as string);
      delete filter.isPublic; // User can see all non-archived non-deleted posts on target profile

      // If the target user has a private account, only show posts to followers.
      // Public endpoints (unauthenticated) see nothing for private accounts.
      const targetUser = await User.findById(filter.userId).select('isPrivate').lean() as any;
      if (targetUser?.isPrivate) {
        if (!req.user) {
          // Not logged in — no content
          res.status(200).json({ success: true, posts: [], pagination: { page, limit, total: 0, pages: 0 } });
          return;
        }
        const viewerId = req.user.id;
        const targetId = filter.userId.toString();
        // Owner can always see own posts
        if (viewerId !== targetId) {
          const isFollower = await Follow.findOne({ followerId: viewerId, followingId: targetId }).select('_id').lean();
          if (!isFollower) {
            res.status(200).json({ success: true, posts: [], pagination: { page, limit, total: 0, pages: 0 } });
            return;
          }
        }
      }
    } else if (req.query.likedBy) {
      // Dynamic liked posts: fetch specific user's liked posts
      const likedPosts = await PostLike.find({ userId: new Types.ObjectId(req.query.likedBy as string) }).select('postId').lean();
      const likedPostIds = likedPosts.map((l: any) => l.postId);
      filter._id = { $in: likedPostIds };
    } else if (tab === 'following') {
      if (req.user) {
        const viewerId = req.user.id;
        const follows = await Follow.find({ followerId: viewerId }).select('followingId').lean();
        const followingIds = [new Types.ObjectId(viewerId), ...follows.map((f: any) => f.followingId)];
        filter.userId = { $in: followingIds };
      }
    } else {
      // Global home feed — exclude posts from private accounts entirely (unless viewer follows them or is owner)
      const privateUserIds = await User.find({ isPrivate: true }).select('_id').lean();
      let privateIds = privateUserIds.map((u: any) => u._id.toString());
      if (req.user) {
        const viewerId = req.user.id;
        const follows = await Follow.find({ followerId: viewerId }).select('followingId').lean();
        const allowedIds = new Set([viewerId, ...follows.map((f: any) => f.followingId.toString())]);
        privateIds = privateIds.filter(id => !allowedIds.has(id));
      }
      if (privateIds.length > 0) {
        filter.userId = { $nin: privateIds.map(id => new Types.ObjectId(id)) };
      }
    }

    const sortOptions: any = tab === 'trending'
      ? { likesCount: -1, viewsCount: -1, createdAt: -1 }
      : { createdAt: -1 };

    const posts = await Post.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .populate('userId', 'profilePic activeFrameId')
      .lean() as any[];

    // Enrich each post with profilePic + active frame data
    const enrichedPosts = await Promise.all(posts.map(async (post) => {
      const p = { ...post };
      if (post.userId && typeof post.userId === 'object') {
        p.userProfilePic = post.userId.profilePic || post.userProfilePic;
        const activeFrameId = post.userId.activeFrameId;
        p.userId = post.userId._id;
        if (activeFrameId) {
          try {
            const { Frame } = await import('../frames/frame.model');
            const frame = await Frame.findById(activeFrameId)
              .select('imageUrl avatarScale').lean();
            if (frame) {
              p.activeFrameUrl = (frame as any).imageUrl ?? '';
              p.activeFrameScale = (frame as any).avatarScale ?? 0.60;
            }
          } catch (_) { /* non-critical */ }
        }
      }
      return p;
    }));

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
      isPublic:       isPublic === false ? false : true,
      isArchived:     false,
      isDeleted:      false,
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
        // Remove activity on unlike
        removeActivity({
          type: 'like_post',
          actorId: req.user!.id,
          recipientId: updated.userId.toString(),
          postId: String(postId),
        }).catch(() => {});
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
          const actor = await User.findById(req.user!.id).select('username profilePic thumbnailUrl').lean() as any;
          createAndSend({
            recipientId: ownerId,
            actorId: req.user!.id,
            actorUsername: actor?.username ?? req.user!.username,
            actorProfilePic: actor?.profilePic ?? '',
            type: 'post_like',
            payload: NotificationTriggers.postLiked(actor?.username ?? req.user!.username),
            referenceId: String(postId),
          }).catch(() => {}); // fire-and-forget
          // ── Activity inbox ──
          const postDoc = await Post.findById(postId).select('thumbnailUrl videoUrl').lean() as any;
          createActivity({
            recipientId: ownerId,
            actorId: req.user!.id,
            type: 'like_post',
            postId: String(postId),
            postThumbnailUrl: postDoc?.thumbnailUrl || postDoc?.videoUrl || '',
          }).catch(() => {});
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
    // Only fetch top-level comments (no parentCommentId)
    const comments = await Comment.find({
      postId: new Types.ObjectId(req.params.id as string),
      parentCommentId: null,
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('userId', 'profilePic username activeFrameId')
      .lean() as any[];

    // For each comment, resolve the active frame URL + scale inline
    const enrichedComments = await Promise.all(comments.map(async (comment) => {
      const c = { ...comment };
      if (comment.userId && typeof comment.userId === 'object') {
        c.userProfilePic = comment.userId.profilePic || comment.userProfilePic;
        const activeFrameId = comment.userId.activeFrameId;
        c.userId = comment.userId._id;

        // Populate frame data
        if (activeFrameId) {
          try {
            const { Frame } = await import('../frames/frame.model');
            const frame = await Frame.findById(activeFrameId)
              .select('imageUrl avatarScale')
              .lean();
            if (frame) {
              c.activeFrameUrl = (frame as any).imageUrl ?? '';
              c.activeFrameScale = (frame as any).avatarScale ?? 0.60;
            }
          } catch (_) { /* non-critical — frame data optional */ }
        }
      }
      // Attach reply count
      c.repliesCount = await Comment.countDocuments({ parentCommentId: c._id ?? comment._id });
      return c;
    }));

    // Attach current user's reactions if authenticated
    let reactionMap: Record<string, string> = {};
    if (req.user && enrichedComments.length > 0) {
      const commentIds = enrichedComments.map((c: any) => c._id);
      const reactions = await CommentLike.find({
        commentId: { $in: commentIds },
        userId: new Types.ObjectId(req.user.id),
      }).select('commentId reaction').lean();
      for (const r of reactions) {
        reactionMap[r.commentId.toString()] = r.reaction;
      }
    }

    const final = enrichedComments.map((c: any) => ({
      ...c,
      myReaction: reactionMap[String(c._id)] ?? null,
    }));

    res.status(200).json({ success: true, comments: final });
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

    const user = await User.findById(req.user.id).select('username profilePic activeFrameId');
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }

    const comment = await Comment.create({
      postId:         new Types.ObjectId(req.params.id as string),
      userId:         new Types.ObjectId(req.user.id),
      username:       user.username,
      userProfilePic: user.profilePic,
      text,
    });

    const updatedPost = await Post.findByIdAndUpdate(
      new Types.ObjectId(req.params.id as string),
      { $inc: { commentsCount: 1 } },
      { new: true }
    ).select('commentsCount').lean();

    // Resolve commenter's active frame for the response
    let activeFrameUrl = '';
    let activeFrameScale = 0.60;
    const activeFrameId = (user as any).activeFrameId;
    if (activeFrameId) {
      try {
        const { Frame } = await import('../frames/frame.model');
        const frame = await Frame.findById(activeFrameId).select('imageUrl avatarScale').lean();
        if (frame) {
          activeFrameUrl = (frame as any).imageUrl ?? '';
          activeFrameScale = (frame as any).avatarScale ?? 0.60;
        }
      } catch (_) {}
    }

    // ── Notify post owner (skip self-comments) ──
    const parentPost = await Post.findById(req.params.id).select('userId thumbnailUrl videoUrl').lean() as any;
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
      // ── Activity inbox ──
      createActivity({
        recipientId: ownerId,
        actorId: req.user.id,
        type: 'comment_post',
        postId: req.params.id as string,
        postThumbnailUrl: parentPost?.thumbnailUrl || parentPost?.videoUrl || '',
        commentText: text.slice(0, 150),
      }).catch(() => {});
    }

    // ── Notify mentioned users ──
    const mentionMatches = text.match(/@([a-zA-Z0-9._]+)/g);
    if (mentionMatches && mentionMatches.length > 0) {
      const usernames = Array.from(new Set(mentionMatches.map((m: string) => m.slice(1).toLowerCase())));
      const mentionedUsers = await User.find({ username: { $in: usernames.map(u => new RegExp(`^${u}$`, 'i')) } }).select('_id username').lean();
      for (const u of mentionedUsers) {
        if (u._id.toString() !== req.user.id) {
          createAndSend({
            recipientId: u._id.toString(),
            actorId: req.user.id,
            actorUsername: user.username,
            actorProfilePic: user.profilePic ?? '',
            type: 'user_mention',
            payload: {
              title: `@${user.username} mentioned you in a comment`,
              body: `@${user.username}: ${text.slice(0, 100)}`,
              data: { type: 'user_mention', postId: req.params.id as string },
            },
            referenceId: req.params.id as string,
          }).catch(() => {});
          // ── Activity inbox ──
          createActivity({
            recipientId: u._id.toString(),
            actorId: req.user.id,
            type: 'mention',
            postId: req.params.id as string,
            commentText: text.slice(0, 150),
          }).catch(() => {});
        }
      }
    }

    res.status(201).json({
      success: true,
      commentsCount: (updatedPost as any)?.commentsCount ?? 0,
      comment: {
        ...((comment as any).toObject?.() ?? comment),
        activeFrameUrl,
        activeFrameScale,
      },
    });
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
      // Remove save activity on unsave
      const unsavedPost = await Post.findById(postId).select('userId').lean();
      if (unsavedPost?.userId && String(unsavedPost.userId) !== req.user!.id) {
        removeActivity({
          type: 'save_post',
          actorId: req.user!.id,
          recipientId: String(unsavedPost.userId),
          postId: String(postId),
        }).catch(() => {});
      }
    } else {
      await PostSave.create({ postId, userId });
      isSaved = true;

      // ── Notify post owner (skip self-saves) ──
      const savedPost = await Post.findById(postId).select('userId thumbnailUrl videoUrl').lean() as any;
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
        // ── Activity inbox ──
        createActivity({
          recipientId: ownerId,
          actorId: req.user!.id,
          type: 'save_post',
          postId: String(postId),
          postThumbnailUrl: savedPost?.thumbnailUrl || savedPost?.videoUrl || '',
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

// POST /feed/:id/report — User reports a video with category & optional description
export const reportPost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const { category, description } = req.body;
    if (!category) {
      res.status(400).json({ success: false, message: 'Category is required' });
      return;
    }

    const postId = new Types.ObjectId(req.params.id as string);
    const userId = new Types.ObjectId(req.user.id);

    const post = await Post.findById(postId);
    if (!post) {
      res.status(404).json({ success: false, message: 'Post not found' });
      return;
    }

    // Check if user already reported this post
    const alreadyReported = post.reports.some(r => r.userId.toString() === req.user!.id);
    if (alreadyReported) {
      res.status(400).json({ success: false, message: 'You have already reported this video.' });
      return;
    }

    post.reports.push({
      userId,
      category,
      description: description || '',
      createdAt: new Date(),
    });
    post.reportedCount = post.reports.length;

    await post.save();

    res.status(200).json({ success: true, message: 'Report submitted successfully. Thank you for keeping Gobilive safe.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /feed/:id/appeal — Creator appeals video deletion
export const appealPost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const { appealReason } = req.body;
    if (!appealReason || !appealReason.trim()) {
      res.status(400).json({ success: false, message: 'Appeal reason is required' });
      return;
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      res.status(404).json({ success: false, message: 'Post not found' });
      return;
    }

    if (post.userId.toString() !== req.user.id) {
      res.status(403).json({ success: false, message: 'Forbidden: only creator can appeal' });
      return;
    }

    if (!post.isDeleted) {
      res.status(400).json({ success: false, message: 'This video is not deleted' });
      return;
    }

    post.appealStatus = 'pending';
    post.appealReason = appealReason.trim();
    post.appealedAt = new Date();

    await post.save();

    res.status(200).json({ success: true, message: 'Appeal submitted to our team successfully', post });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /feed/public — Public feed of uploaded user shorts/videos for web portal
export const getPublicFeed = async (req: any, res: Response): Promise<void> => {
  try {
    const page  = parseInt(req.query.page  as string) || 1;
    const limit = parseInt(req.query.limit as string) || 30;
    const skip  = (page - 1) * limit;

    // Exclude posts from private accounts in the global public feed
    const privateUserIds = await User.find({ isPrivate: true }).select('_id').lean();
    const privateIds = privateUserIds.map((u: any) => u._id);

    const filter: any = {
      isPublic: true,
      isArchived: { $ne: true },
      isDeleted: { $ne: true },
      ...(privateIds.length > 0 ? { userId: { $nin: privateIds } } : {}),
    };

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

// POST /feed/:id/repost — Repost video to current user profile feed
// body: { note?: string }
export const repostPost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const originalPost = await Post.findById(req.params.id);
    if (!originalPost) {
      res.status(404).json({ success: false, message: 'Post not found' });
      return;
    }

    const user = await User.findById(req.user.id).select('username profilePic');
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }

    // Optional note attached to the repost
    const note: string = (req.body?.note as string | undefined)?.trim() ?? '';

    // Increment share/repost count on original
    await Post.findByIdAndUpdate(req.params.id, { $inc: { sharesCount: 1 } });

    // Build caption: if note provided use it, otherwise default label
    const caption = note
      ? note
      : `Reposted from @${originalPost.username}: ${originalPost.caption}`;

    // Create a repost under the current user's account
    const reposted = await Post.create({
      userId: new Types.ObjectId(req.user.id),
      username: user.username,
      userProfilePic: user.profilePic,
      postType: originalPost.postType,
      videoUrl: originalPost.videoUrl,
      imageUrls: originalPost.imageUrls,
      thumbnailUrl: originalPost.thumbnailUrl,
      blurHash: originalPost.blurHash,
      aspectRatio: originalPost.aspectRatio,
      caption,
      tags: originalPost.tags,
      duration: originalPost.duration,
      isPublic: true,
      originalPostId: originalPost._id,
    });

    // ── Activity inbox: notify original post owner ──
    const originalOwnerId = originalPost.userId?.toString();
    if (originalOwnerId && originalOwnerId !== req.user!.id) {
      createActivity({
        recipientId: originalOwnerId,
        actorId: req.user!.id,
        type: 'repost_post',
        postId: String(originalPost._id),
        postThumbnailUrl: originalPost.thumbnailUrl || originalPost.videoUrl || '',
      }).catch(() => {});
    }

    res.status(201).json({
      success: true,
      message: 'Post reposted to your profile',
      post: reposted,
      note,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /feed/:id/pin — Pin post to profile top
export const pinPost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const post = await Post.findById(req.params.id);
    if (!post) { res.status(404).json({ success: false, message: 'Post not found' }); return; }

    post.isPinned = true;
    await post.save();

    res.status(200).json({ success: true, message: 'Post pinned', post });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /feed/:id/unpin — Unpin post
export const unpinPost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const post = await Post.findById(req.params.id);
    if (!post) { res.status(404).json({ success: false, message: 'Post not found' }); return; }

    post.isPinned = false;
    await post.save();

    res.status(200).json({ success: true, message: 'Post unpinned', post });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// POST /feed/:id/comments/:commentId/react  — like or dislike a comment
// body: { reaction: 'like' | 'dislike' }
// ─────────────────────────────────────────────────────────────────────────────
export const reactToComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const { commentId } = req.params;
    const { reaction } = req.body as { reaction?: string };
    if (reaction !== 'like' && reaction !== 'dislike') {
      res.status(400).json({ success: false, message: "reaction must be 'like' or 'dislike'" });
      return;
    }

    const commentObjId  = new Types.ObjectId(commentId as string);
    const userObjId     = new Types.ObjectId(req.user.id);

    const comment = await Comment.findById(commentObjId);
    if (!comment) { res.status(404).json({ success: false, message: 'Comment not found' }); return; }

    const existing = await CommentLike.findOne({ commentId: commentObjId, userId: userObjId });

    if (existing) {
      if (existing.reaction === reaction) {
        // Toggle off — remove the reaction
        await CommentLike.deleteOne({ _id: existing._id });
        const field = reaction === 'like' ? 'likesCount' : 'dislikesCount';
        await Comment.findByIdAndUpdate(commentObjId, { $inc: { [field]: -1 } });
        const updated = await Comment.findById(commentObjId).select('likesCount dislikesCount').lean();
        res.status(200).json({ success: true, reaction: null, ...updated });
      } else {
        // Switch reaction
        const oldField = existing.reaction === 'like' ? 'likesCount' : 'dislikesCount';
        const newField = reaction === 'like' ? 'likesCount' : 'dislikesCount';
        existing.reaction = reaction;
        await existing.save();
        await Comment.findByIdAndUpdate(commentObjId, {
          $inc: { [oldField]: -1, [newField]: 1 },
        });
        const updated = await Comment.findById(commentObjId).select('likesCount dislikesCount').lean();
        res.status(200).json({ success: true, reaction, ...updated });
      }
    } else {
      // New reaction
      await CommentLike.create({ commentId: commentObjId, userId: userObjId, reaction });
      const field = reaction === 'like' ? 'likesCount' : 'dislikesCount';
      await Comment.findByIdAndUpdate(commentObjId, { $inc: { [field]: 1 } });
      const updated = await Comment.findById(commentObjId).select('likesCount dislikesCount').lean();
      // ── Activity inbox: notify comment author on like (not dislike) ──
      if (reaction === 'like') {
        const commentAuthorId = comment.userId?.toString();
        if (commentAuthorId && commentAuthorId !== req.user.id) {
          createActivity({
            recipientId: commentAuthorId,
            actorId: req.user.id,
            type: 'like_comment',
            commentId: String(commentObjId),
            commentText: comment.text?.slice(0, 150) ?? '',
          }).catch(() => {});
        }
      }
      res.status(200).json({ success: true, reaction, ...updated });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /feed/:id/comments/:commentId/replies  — reply to a comment
// body: { text: string }
// ─────────────────────────────────────────────────────────────────────────────
export const replyToComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const { text } = req.body;
    if (!text) { res.status(400).json({ success: false, message: 'text is required' }); return; }

    const { commentId } = req.params;
    const parent = await Comment.findById(commentId);
    if (!parent) { res.status(404).json({ success: false, message: 'Parent comment not found' }); return; }

    const user = await User.findById(req.user.id).select('username profilePic activeFrameId');
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }

    const reply = await Comment.create({
      postId:          parent.postId,
      userId:          new Types.ObjectId(req.user.id),
      username:        user.username,
      userProfilePic:  user.profilePic,
      text,
      parentCommentId: parent._id,
    });

    // Increment the post's commentsCount for replies too
    await Post.findByIdAndUpdate(parent.postId, { $inc: { commentsCount: 1 } });

    // Resolve active frame
    let activeFrameUrl = '';
    let activeFrameScale = 0.60;
    const activeFrameId = (user as any).activeFrameId;
    if (activeFrameId) {
      try {
        const { Frame } = await import('../frames/frame.model');
        const frame = await Frame.findById(activeFrameId).select('imageUrl avatarScale').lean();
        if (frame) {
          activeFrameUrl = (frame as any).imageUrl ?? '';
          activeFrameScale = (frame as any).avatarScale ?? 0.60;
        }
      } catch (_) {}
    }

    // ── Activity inbox: notify parent comment author on reply ──
    const parentAuthorId = parent.userId?.toString();
    if (parentAuthorId && parentAuthorId !== req.user.id) {
      createActivity({
        recipientId: parentAuthorId,
        actorId: req.user.id,
        type: 'reply_comment',
        postId: String(parent.postId),
        commentId: String(parent._id),
        commentText: text.slice(0, 150),
      }).catch(() => {});
    }

    res.status(201).json({
      success: true,
      reply: {
        ...((reply as any).toObject?.() ?? reply),
        activeFrameUrl,
        activeFrameScale,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /feed/:id/comments/:commentId/replies  — fetch replies for a comment
// ─────────────────────────────────────────────────────────────────────────────
export const getReplies = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { commentId } = req.params;
    const page  = parseInt(req.query.page  as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip  = (page - 1) * limit;

    const replies = await Comment.find({ parentCommentId: new Types.ObjectId(commentId as string) })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Attach user's reactions if authenticated
    let reactionMap: Record<string, string> = {};
    if (req.user) {
      const replyIds = replies.map((r: any) => r._id);
      const reactions = await CommentLike.find({
        commentId: { $in: replyIds },
        userId: new Types.ObjectId(req.user.id),
      }).select('commentId reaction').lean();
      for (const r of reactions) {
        reactionMap[r.commentId.toString()] = r.reaction;
      }
    }

    const enriched = replies.map((r: any) => ({
      ...r,
      myReaction: reactionMap[r._id.toString()] ?? null,
    }));

    res.status(200).json({ success: true, replies: enriched });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /feed/:id/reposts  — fetch all reposts (with notes) for a post
// ─────────────────────────────────────────────────────────────────────────────
export const getReposts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string;
    const page  = parseInt(req.query.page  as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip  = (page - 1) * limit;

    // All posts that are reposts of this original
    const reposts = await Post.find({
      originalPostId: new Types.ObjectId(postId),
      isDeleted: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('userId username userProfilePic caption createdAt likesCount')
      .lean();

    const total = await Post.countDocuments({
      originalPostId: new Types.ObjectId(postId),
      isDeleted: { $ne: true },
    });

    // Attach isLiked for current user if authenticated
    let likedSet = new Set<string>();
    if (req.user && reposts.length > 0) {
      const repostIds = reposts.map((r: any) => r._id);
      const likes = await (await import('./post_like.model')).PostLike
        .find({ userId: new Types.ObjectId(req.user.id), postId: { $in: repostIds } })
        .select('postId')
        .lean();
      likedSet = new Set(likes.map((l: any) => String(l.postId)));
    }

    // Check if viewer follows these users
    let followingSet = new Set<string>();
    if (req.user && reposts.length > 0) {
      const { Follow } = await import('../auth/follow.model');
      const follows = await Follow.find({
        followerId: new Types.ObjectId(req.user.id),
        followingId: { $in: reposts.map((r: any) => r.userId) },
      }).select('followingId').lean();
      followingSet = new Set(follows.map((f: any) => String(f.followingId)));
    }

    const enriched = reposts.map((r: any) => ({
      repostId: String(r._id),
      userId: String(r.userId),
      username: r.username,
      userProfilePic: r.userProfilePic,
      // caption IS the note for reposts (see repostPost logic)
      note: r.caption?.startsWith('Reposted from') ? '' : (r.caption ?? ''),
      createdAt: r.createdAt,
      likesCount: r.likesCount ?? 0,
      isLiked: likedSet.has(String(r._id)),
      isFollowing: followingSet.has(String(r.userId)),
      isOwn: req.user ? String(r.userId) === req.user.id : false,
    }));

    res.status(200).json({ success: true, reposts: enriched, total });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /feed/:id/reposts/:repostId  — delete own repost note
// ─────────────────────────────────────────────────────────────────────────────
export const deleteRepost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const { repostId } = req.params;
    const repost = await Post.findById(repostId);
    if (!repost) { res.status(404).json({ success: false, message: 'Repost not found' }); return; }
    if (String(repost.userId) !== req.user.id) {
      res.status(403).json({ success: false, message: 'Not authorized' });
      return;
    }

    // Decrement sharesCount on original
    if (repost.originalPostId) {
      await Post.findByIdAndUpdate(repost.originalPostId, { $inc: { sharesCount: -1 } });
    }

    await Post.findByIdAndDelete(repostId);
    res.status(200).json({ success: true, message: 'Repost deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
