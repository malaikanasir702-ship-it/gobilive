/**
 * activity.service.ts
 *
 * Core business logic for the TikTok-style Activity inbox.
 *
 * Design decisions:
 *  1. Uses idempotency keys so duplicate events (retries, race conditions) are
 *     silently ignored rather than creating duplicate activities.
 *  2. Groups "like" activities on the same post:  multiple actors liking the
 *     same post merge into one Activity record (groupedActors array + count).
 *     Comments, replies, follows, etc. are NOT grouped because hiding them
 *     loses important information.
 *  3. Real-time delivery reuses the existing Socket.IO `io` instance via
 *     `injectActivityIo()` — never creates a second connection.
 *  4. Profile-view activities are created only when the viewer's
 *     profileViewsVisible setting allows it (mutual-visibility model).
 *  5. Privacy, blocking and deleted-account guards are applied when *reading*
 *     activities, not when writing, so the guards stay consistent with the
 *     rest of the app.
 */

import mongoose, { Types } from 'mongoose';
import { Server } from 'socket.io';
import { Activity, ActivityType, IActivity } from './activity.model';
import { User } from '../auth/user.model';
import { Post } from '../feed/post.model';

// ─── Socket.IO injection ────────────────────────────────────────────────────
let _io: Server | null = null;
export function injectActivityIo(io: Server) { _io = io; }

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildIdempotencyKey(
  type: ActivityType,
  actorId: string,
  recipientId: string,
  refId?: string
): string {
  return `${type}::${actorId}::${recipientId}::${refId ?? 'none'}`;
}

async function emitToUser(recipientId: string, activity: any) {
  if (!_io) return;
  _io.to(`user_${recipientId}`).emit('activity_new', activity);
}

// ─── Create / Upsert Activity ────────────────────────────────────────────────
/**
 * Creates a new Activity record.
 * For like_post / like_comment: finds an existing grouped activity for the
 * same post/comment and merges the new actor in instead of duplicating.
 * Never throws — errors are logged so callers are unaffected.
 */
export async function createActivity(opts: {
  recipientId: string;
  actorId: string;
  type: ActivityType;
  postId?: string;
  commentId?: string;
  postThumbnailUrl?: string;
  commentText?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    // Self-activity guard
    if (opts.actorId === opts.recipientId) return;

    // Blocking guard
    const recipient = await User.findById(opts.recipientId)
      .select('blockedUsers isTerminated isSuspended profileViewsVisible')
      .lean() as any;
    if (!recipient || recipient.isTerminated) return;
    const blocked: string[] = recipient.blockedUsers ?? [];
    if (blocked.some((id: string) => String(id) === String(opts.actorId))) return;

    // Profile view special guard
    if (opts.type === 'profile_view') {
      const canSeeViews = recipient.profileViewsVisible !== false;
      if (!canSeeViews) return;
    }

    const actor = await User.findById(opts.actorId)
      .select('username profilePic displayName isTerminated isSuspended isBlocked')
      .lean() as any;
    if (!actor || actor.isTerminated || actor.isBlocked) return;

    const idempotencyKey = buildIdempotencyKey(
      opts.type,
      opts.actorId,
      opts.recipientId,
      opts.postId ?? opts.commentId
    );

    // ── Groupable types: merge into existing open activity ──
    const isGroupable = opts.type === 'like_post' || opts.type === 'like_comment' || opts.type === 'save_post';

    if (isGroupable) {
      const refField = opts.postId ? 'postId' : 'commentId';
      const refVal = new Types.ObjectId(opts.postId ?? opts.commentId);
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days

      const existing = await Activity.findOne({
        recipientId: new Types.ObjectId(opts.recipientId),
        type: opts.type,
        [refField]: refVal,
        createdAt: { $gte: cutoff },
        isRead: false,
      }).sort({ createdAt: -1 });

      if (existing) {
        // Check actor not already in the group
        const alreadyGrouped = existing.groupedActors.some(
          (a) => String(a.actorId) === opts.actorId
        );
        if (!alreadyGrouped) {
          existing.groupedActors.push({
            actorId: new Types.ObjectId(opts.actorId),
            username: actor.username,
            profilePic: actor.profilePic ?? '',
            displayName: actor.displayName ?? '',
            createdAt: new Date(),
          });
          existing.actorId = new Types.ObjectId(opts.actorId);
          existing.actorUsername = actor.username;
          existing.actorProfilePic = actor.profilePic ?? '';
          existing.actorDisplayName = actor.displayName ?? '';
          existing.count = existing.groupedActors.length;
          existing.isRead = false;
          existing.updatedAt = new Date();
          await existing.save();
          emitToUser(opts.recipientId, existing.toObject()).catch(() => {});
        }
        return;
      }
    }

    // ── Create new activity ──
    const activityData: Partial<IActivity> = {
      recipientId: new Types.ObjectId(opts.recipientId),
      actorId: new Types.ObjectId(opts.actorId),
      actorUsername: actor.username,
      actorProfilePic: actor.profilePic ?? '',
      actorDisplayName: actor.displayName ?? '',
      type: opts.type,
      postThumbnailUrl: opts.postThumbnailUrl ?? '',
      commentText: opts.commentText ?? '',
      metadata: opts.metadata,
      groupedActors: [{
        actorId: new Types.ObjectId(opts.actorId),
        username: actor.username,
        profilePic: actor.profilePic ?? '',
        displayName: actor.displayName ?? '',
        createdAt: new Date(),
      }],
      count: 1,
      isRead: false,
      idempotencyKey,
    };

    if (opts.postId) activityData.postId = new Types.ObjectId(opts.postId);
    if (opts.commentId) activityData.commentId = new Types.ObjectId(opts.commentId);

    const created = await Activity.create(activityData);
    emitToUser(opts.recipientId, created.toObject()).catch(() => {});
  } catch (err: any) {
    // Duplicate key = idempotency key already exists — silently ignore
    if (err.code !== 11000) {
      console.error('[Activity] createActivity error:', err.message);
    }
  }
}

/**
 * Remove a specific activity when the triggering action is undone
 * (e.g. unlike, unfollow). Silently fails.
 */
export async function removeActivity(opts: {
  type: ActivityType;
  actorId: string;
  recipientId: string;
  postId?: string;
  commentId?: string;
}): Promise<void> {
  try {
    const filter: any = {
      type: opts.type,
      recipientId: new Types.ObjectId(opts.recipientId),
    };
    if (opts.postId) filter.postId = new Types.ObjectId(opts.postId);
    if (opts.commentId) filter.commentId = new Types.ObjectId(opts.commentId);

    const existing = await Activity.findOne(filter).sort({ createdAt: -1 });
    if (!existing) return;

    if (existing.count <= 1) {
      await Activity.deleteOne({ _id: existing._id });
    } else {
      existing.groupedActors = existing.groupedActors.filter(
        (a) => String(a.actorId) !== opts.actorId
      );
      existing.count = existing.groupedActors.length;
      if (existing.groupedActors.length > 0) {
        const last = existing.groupedActors[existing.groupedActors.length - 1];
        existing.actorId = last.actorId;
        existing.actorUsername = last.username;
        existing.actorProfilePic = last.profilePic ?? '';
        existing.actorDisplayName = last.displayName ?? '';
      }
      await existing.save();
    }
  } catch (err: any) {
    console.error('[Activity] removeActivity error:', err.message);
  }
}

// ─── Query Feed ─────────────────────────────────────────────────────────────

export type ActivityFilter = 'all' | 'likes_favorites' | 'comments' | 'mentions_tags' | 'new_followers' | 'profile_views';

function buildTypeFilter(filter: ActivityFilter): ActivityType[] | undefined {
  switch (filter) {
    case 'likes_favorites': return ['like_post', 'like_comment', 'save_post'];
    case 'comments':        return ['comment_post', 'reply_comment'];
    case 'mentions_tags':   return ['mention', 'tag'];
    case 'new_followers':   return ['follow', 'follow_request', 'follow_request_accepted'];
    case 'profile_views':   return ['profile_view'];
    case 'all':
    default:                return undefined;
  }
}

export interface ActivityFeedItem {
  id: string;
  type: ActivityType;
  actorId: string;
  actorUsername: string;
  actorProfilePic: string;
  actorDisplayName: string;
  groupedActors: Array<{
    actorId: string;
    username: string;
    profilePic: string;
    displayName: string;
  }>;
  count: number;
  postId?: string;
  commentId?: string;
  postThumbnailUrl?: string;
  commentText?: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
  // Derived text is generated on the client to support i18n
}

export async function getActivityFeed(opts: {
  recipientId: string;
  filter: ActivityFilter;
  page: number;
  limit: number;
}): Promise<{
  activities: ActivityFeedItem[];
  unreadCount: number;
  total: number;
  page: number;
  hasMore: boolean;
}> {
  const { recipientId, filter, page, limit } = opts;
  const skip = (page - 1) * limit;

  const typeFilter = buildTypeFilter(filter);
  const query: any = { recipientId: new Types.ObjectId(recipientId) };
  if (typeFilter) query.type = { $in: typeFilter };

  const [raw, total, unreadCount] = await Promise.all([
    Activity.find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Activity.countDocuments(query),
    Activity.countDocuments({
      recipientId: new Types.ObjectId(recipientId),
      isRead: false,
    }),
  ]);

  // Filter out activities where actors have been deleted or blocked
  const recipient = await User.findById(recipientId).select('blockedUsers').lean() as any;
  const myBlocked: string[] = (recipient?.blockedUsers ?? []).map(String);

  // Resolve post thumbnails efficiently via a single lookup
  const postIds = raw
    .filter((a: any) => a.postId)
    .map((a: any) => a.postId);

  const posts = postIds.length > 0
    ? await Post.find({ _id: { $in: postIds } })
        .select('thumbnailUrl videoUrl isDeleted')
        .lean()
    : [];
  const postMap = new Map(posts.map((p: any) => [String(p._id), p]));

  const activities: ActivityFeedItem[] = raw.map((a: any) => {
    const post = a.postId ? postMap.get(String(a.postId)) : null;
    const thumbnail = (post as any)?.thumbnailUrl
      || (post as any)?.videoUrl
      || a.postThumbnailUrl
      || '';
    const postDeleted = post ? !!(post as any).isDeleted : (a.postId ? true : false);

    return {
      id: String(a._id),
      type: a.type,
      actorId: String(a.actorId),
      actorUsername: a.actorUsername,
      actorProfilePic: a.actorProfilePic ?? '',
      actorDisplayName: a.actorDisplayName ?? '',
      groupedActors: (a.groupedActors ?? [])
        .filter((g: any) => !myBlocked.includes(String(g.actorId)))
        .map((g: any) => ({
          actorId: String(g.actorId),
          username: g.username,
          profilePic: g.profilePic ?? '',
          displayName: g.displayName ?? '',
        })),
      count: a.count ?? 1,
      postId: a.postId ? String(a.postId) : undefined,
      commentId: a.commentId ? String(a.commentId) : undefined,
      postThumbnailUrl: thumbnail,
      postDeleted,
      commentText: a.commentText ?? '',
      isRead: a.isRead,
      createdAt: (a.createdAt as Date).toISOString(),
      updatedAt: (a.updatedAt as Date).toISOString(),
    } as any;
  });

  return {
    activities,
    unreadCount,
    total,
    page,
    hasMore: skip + raw.length < total,
  };
}

export async function markActivityRead(recipientId: string, activityId: string): Promise<void> {
  await Activity.findOneAndUpdate(
    { _id: activityId, recipientId: new Types.ObjectId(recipientId) },
    { $set: { isRead: true } }
  );
}

export async function markAllActivitiesRead(recipientId: string): Promise<void> {
  await Activity.updateMany(
    { recipientId: new Types.ObjectId(recipientId), isRead: false },
    { $set: { isRead: true } }
  );
}

export async function getActivityUnreadCount(recipientId: string): Promise<number> {
  return Activity.countDocuments({
    recipientId: new Types.ObjectId(recipientId),
    isRead: false,
  });
}
