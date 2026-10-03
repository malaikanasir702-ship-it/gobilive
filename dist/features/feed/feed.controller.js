"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminPromotionStats = exports.updateAdminCampaignStatus = exports.getAdminPromotionCampaigns = exports.deleteAdminPromotionPackage = exports.updateAdminPromotionPackage = exports.createAdminPromotionPackage = exports.getAdminPromotionPackages = exports.promotePost = exports.getPromotionPackages = exports.markNotInterested = exports.deleteRepost = exports.getReposts = exports.getReplies = exports.replyToComment = exports.reactToComment = exports.unpinPost = exports.pinPost = exports.repostPost = exports.getPublicFeed = exports.appealPost = exports.reportPost = exports.getSavedPosts = exports.savePost = exports.getArchivedPosts = exports.editPost = exports.restorePost = exports.archivePost = exports.deletePost = exports.addComment = exports.viewPost = exports.sharePost = exports.getComments = exports.likePost = exports.createPost = exports.getFeed = void 0;
const mongoose_1 = require("mongoose");
const post_model_1 = require("./post.model");
const comment_model_1 = require("./comment.model");
const comment_like_model_1 = require("./comment_like.model");
const post_like_model_1 = require("./post_like.model");
const post_save_model_1 = require("./post_save.model");
const user_model_1 = require("../auth/user.model");
const follow_model_1 = require("../auth/follow.model");
const notification_service_1 = require("../notifications/notification.service");
const activity_service_1 = require("../activity/activity.service");
const promotion_model_1 = require("./promotion.model");
// GET /feed?page=1&limit=10&userId=xxx&likedBy=xxx
const getFeed = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const tab = req.query.tab || 'forYou';
        const filter = { isPublic: { $ne: false }, isArchived: { $ne: true }, isDeleted: { $ne: true } };
        if (req.query.userId) {
            filter.userId = new mongoose_1.Types.ObjectId(req.query.userId);
            delete filter.isPublic; // User can see all non-archived non-deleted posts on target profile
            // If the target user has a private account, only show posts to followers.
            // Public endpoints (unauthenticated) see nothing for private accounts.
            const targetUser = await user_model_1.User.findById(filter.userId).select('isPrivate').lean();
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
                    const isFollower = await follow_model_1.Follow.findOne({ followerId: viewerId, followingId: targetId }).select('_id').lean();
                    if (!isFollower) {
                        res.status(200).json({ success: true, posts: [], pagination: { page, limit, total: 0, pages: 0 } });
                        return;
                    }
                }
            }
        }
        else if (req.query.likedBy) {
            // Dynamic liked posts: fetch specific user's liked posts
            const likedPosts = await post_like_model_1.PostLike.find({ userId: new mongoose_1.Types.ObjectId(req.query.likedBy) }).select('postId').lean();
            const likedPostIds = likedPosts.map((l) => l.postId);
            filter._id = { $in: likedPostIds };
        }
        else if (tab === 'following') {
            if (req.user) {
                const viewerId = req.user.id;
                const follows = await follow_model_1.Follow.find({ followerId: viewerId }).select('followingId').lean();
                const followingIds = [new mongoose_1.Types.ObjectId(viewerId), ...follows.map((f) => f.followingId)];
                filter.userId = { $in: followingIds };
            }
        }
        else {
            // Global home feed — exclude posts from private accounts entirely (unless viewer follows them or is owner)
            const privateUserIds = await user_model_1.User.find({ isPrivate: true }).select('_id').lean();
            let privateIds = privateUserIds.map((u) => u._id.toString());
            if (req.user) {
                const viewerId = req.user.id;
                const follows = await follow_model_1.Follow.find({ followerId: viewerId }).select('followingId').lean();
                const allowedIds = new Set([viewerId, ...follows.map((f) => f.followingId.toString())]);
                privateIds = privateIds.filter(id => !allowedIds.has(id));
            }
            if (privateIds.length > 0) {
                filter.userId = { $nin: privateIds.map(id => new mongoose_1.Types.ObjectId(id)) };
            }
        }
        // Exclude posts & authors marked as 'not interested' by viewer
        if (req.user) {
            const viewer = await user_model_1.User.findById(req.user.id).select('notInterestedPosts notInterestedAuthors').lean();
            if (viewer?.notInterestedPosts?.length) {
                filter._id = filter._id ? { ...filter._id, $nin: viewer.notInterestedPosts } : { $nin: viewer.notInterestedPosts };
            }
            if (viewer?.notInterestedAuthors?.length) {
                if (!filter.userId) {
                    filter.userId = { $nin: viewer.notInterestedAuthors };
                }
                else if (filter.userId.$nin) {
                    filter.userId.$nin = [...filter.userId.$nin, ...viewer.notInterestedAuthors];
                }
            }
        }
        const sortOptions = tab === 'trending'
            ? { likesCount: -1, viewsCount: -1, createdAt: -1 }
            : { createdAt: -1 };
        const posts = await post_model_1.Post.find(filter)
            .sort(sortOptions)
            .skip(skip)
            .limit(limit)
            .populate('userId', 'profilePic activeFrameId')
            .lean();
        // Real Promotion Distribution: inject active promoted post into page 1 for 'forYou' feed
        if (page === 1 && tab === 'forYou') {
            try {
                const activeCampaign = await promotion_model_1.PromotionCampaign.findOne({ status: 'active' }).populate('postId');
                if (activeCampaign && activeCampaign.postId) {
                    const rawPromoted = activeCampaign.postId.toObject ? activeCampaign.postId.toObject() : activeCampaign.postId;
                    if (rawPromoted && !posts.some(p => String(p._id) === String(rawPromoted._id))) {
                        rawPromoted.isPromoted = true;
                        posts.splice(1, 0, rawPromoted);
                    }
                    activeCampaign.deliveredCount = (activeCampaign.deliveredCount || 0) + 1;
                    if (activeCampaign.deliveredCount >= activeCampaign.targetCount) {
                        activeCampaign.status = 'completed';
                        await post_model_1.Post.updateOne({ _id: activeCampaign.postId }, { $set: { isPromoted: false } });
                    }
                    await activeCampaign.save();
                    await post_model_1.Post.updateOne({ _id: activeCampaign.postId }, { $inc: { viewsCount: 1 } });
                }
            }
            catch (_) { /* non-critical */ }
        }
        // Enrich each post with profilePic + active frame data
        const enrichedPosts = await Promise.all(posts.map(async (post) => {
            const p = { ...post };
            if (post.userId && typeof post.userId === 'object') {
                p.userProfilePic = post.userId.profilePic || post.userProfilePic;
                const activeFrameId = post.userId.activeFrameId;
                p.userId = post.userId._id;
                if (activeFrameId) {
                    try {
                        const { Frame } = await Promise.resolve().then(() => __importStar(require('../frames/frame.model')));
                        const frame = await Frame.findById(activeFrameId)
                            .select('imageUrl avatarScale').lean();
                        if (frame) {
                            p.activeFrameUrl = frame.imageUrl ?? '';
                            p.activeFrameScale = frame.avatarScale ?? 0.60;
                        }
                    }
                    catch (_) { /* non-critical */ }
                }
            }
            return p;
        }));
        // Attach isLiked + isSaved for current user
        if (req.user && enrichedPosts.length > 0) {
            const postIds = enrichedPosts.map(p => new mongoose_1.Types.ObjectId(p._id ?? p.id));
            const userId = new mongoose_1.Types.ObjectId(req.user.id);
            const [likes, saves] = await Promise.all([
                post_like_model_1.PostLike.find({ userId, postId: { $in: postIds } }).select('postId').lean(),
                post_save_model_1.PostSave.find({ userId, postId: { $in: postIds } }).select('postId').lean(),
            ]);
            const likedSet = new Set(likes.map(l => String(l.postId)));
            const savedSet = new Set(saves.map(s => String(s.postId)));
            for (const p of enrichedPosts) {
                const pid = String(p._id ?? p.id);
                p.isLiked = likedSet.has(pid);
                p.isSaved = savedSet.has(pid);
            }
        }
        const total = await post_model_1.Post.countDocuments(filter);
        res.status(200).json({
            success: true,
            posts: enrichedPosts,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getFeed = getFeed;
// POST /feed  (create post)
const createPost = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const { videoUrl, imageUrls, thumbnailUrl, blurHash, aspectRatio, caption, tags, duration, isPublic, postType, location, allowComments, } = req.body;
        const hasVideo = !!videoUrl;
        const hasImages = Array.isArray(imageUrls) && imageUrls.length > 0;
        if (!hasVideo && !hasImages) {
            res.status(400).json({ success: false, message: 'videoUrl or imageUrls required' });
            return;
        }
        const user = await user_model_1.User.findById(req.user.id).select('username profilePic');
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
        const resolvedType = postType || (hasVideo ? 'video' : 'image');
        const post = await post_model_1.Post.create({
            userId: new mongoose_1.Types.ObjectId(req.user.id),
            username: user.username,
            userProfilePic: user.profilePic,
            postType: resolvedType,
            videoUrl: videoUrl || '',
            imageUrls: hasImages ? imageUrls : [],
            thumbnailUrl: thumbnailUrl || (hasImages ? imageUrls[0] : ''),
            blurHash: blurHash || '',
            aspectRatio: aspectRatio != null ? Number(aspectRatio) : 0.5625,
            caption: caption || '',
            tags: tags || [],
            duration: duration || 0,
            isPublic: isPublic === false ? false : true,
            isArchived: false,
            isDeleted: false,
            location: location || '',
            allowComments: allowComments !== false,
        });
        res.status(201).json({ success: true, post });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.createPost = createPost;
// POST /feed/:id/like
const likePost = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const postId = new mongoose_1.Types.ObjectId(req.params.id);
        const userId = new mongoose_1.Types.ObjectId(req.user.id);
        const postExists = await post_model_1.Post.findById(postId).select('_id likesCount');
        if (!postExists) {
            res.status(404).json({ success: false, message: 'Post not found' });
            return;
        }
        const existing = await post_like_model_1.PostLike.findOne({ postId, userId }).select('_id');
        let isLiked = false;
        let updated;
        if (existing) {
            await post_like_model_1.PostLike.deleteOne({ _id: existing._id });
            updated = await post_model_1.Post.findByIdAndUpdate(postId, { $inc: { likesCount: -1 } }, { new: true }).select('likesCount userId');
            // Safety clamp (in case of data mismatch)
            if (updated && updated.likesCount < 0) {
                updated.likesCount = 0;
                await updated.save();
            }
            // Decrement post owner's total likes count
            if (updated?.userId) {
                await user_model_1.User.findByIdAndUpdate(updated.userId, { $inc: { likesCount: -1 } });
                // Remove activity on unlike
                (0, activity_service_1.removeActivity)({
                    type: 'like_post',
                    actorId: req.user.id,
                    recipientId: updated.userId.toString(),
                    postId: String(postId),
                }).catch(() => { });
            }
            isLiked = false;
        }
        else {
            // Unique index prevents multi-likes even if client spams the button quickly
            try {
                await post_like_model_1.PostLike.create({ postId, userId });
                updated = await post_model_1.Post.findByIdAndUpdate(postId, { $inc: { likesCount: 1 } }, { new: true }).select('likesCount userId');
                // Increment post owner's total likes count
                if (updated?.userId) {
                    await user_model_1.User.findByIdAndUpdate(updated.userId, { $inc: { likesCount: 1 } });
                }
                isLiked = true;
                // ── Notify post owner (skip self-likes) ──
                const ownerId = updated?.userId?.toString();
                if (ownerId && ownerId !== req.user.id) {
                    const actor = await user_model_1.User.findById(req.user.id).select('username profilePic thumbnailUrl').lean();
                    (0, notification_service_1.createAndSend)({
                        recipientId: ownerId,
                        actorId: req.user.id,
                        actorUsername: actor?.username ?? req.user.username,
                        actorProfilePic: actor?.profilePic ?? '',
                        type: 'post_like',
                        payload: notification_service_1.NotificationTriggers.postLiked(actor?.username ?? req.user.username),
                        referenceId: String(postId),
                    }).catch(() => { }); // fire-and-forget
                    // ── Activity inbox ──
                    const postDoc = await post_model_1.Post.findById(postId).select('thumbnailUrl videoUrl').lean();
                    (0, activity_service_1.createActivity)({
                        recipientId: ownerId,
                        actorId: req.user.id,
                        type: 'like_post',
                        postId: String(postId),
                        postThumbnailUrl: postDoc?.thumbnailUrl || postDoc?.videoUrl || '',
                    }).catch(() => { });
                }
            }
            catch (e) {
                // In case of race condition: treat as already liked
                const stillExists = await post_like_model_1.PostLike.findOne({ postId, userId }).select('_id');
                isLiked = !!stillExists;
                updated = await post_model_1.Post.findById(postId).select('likesCount userId');
            }
        }
        res.status(200).json({ success: true, likesCount: updated?.likesCount ?? 0, isLiked });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.likePost = likePost;
// GET /feed/:id/comments
const getComments = async (req, res) => {
    try {
        // Only fetch top-level comments (no parentCommentId)
        const comments = await comment_model_1.Comment.find({
            postId: new mongoose_1.Types.ObjectId(req.params.id),
            parentCommentId: null,
        })
            .sort({ createdAt: -1 })
            .limit(50)
            .populate('userId', 'profilePic username activeFrameId')
            .lean();
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
                        const { Frame } = await Promise.resolve().then(() => __importStar(require('../frames/frame.model')));
                        const frame = await Frame.findById(activeFrameId)
                            .select('imageUrl avatarScale')
                            .lean();
                        if (frame) {
                            c.activeFrameUrl = frame.imageUrl ?? '';
                            c.activeFrameScale = frame.avatarScale ?? 0.60;
                        }
                    }
                    catch (_) { /* non-critical — frame data optional */ }
                }
            }
            // Attach reply count
            c.repliesCount = await comment_model_1.Comment.countDocuments({ parentCommentId: c._id ?? comment._id });
            return c;
        }));
        // Attach current user's reactions if authenticated
        let reactionMap = {};
        if (req.user && enrichedComments.length > 0) {
            const commentIds = enrichedComments.map((c) => c._id);
            const reactions = await comment_like_model_1.CommentLike.find({
                commentId: { $in: commentIds },
                userId: new mongoose_1.Types.ObjectId(req.user.id),
            }).select('commentId reaction').lean();
            for (const r of reactions) {
                reactionMap[r.commentId.toString()] = r.reaction;
            }
        }
        const final = enrichedComments.map((c) => ({
            ...c,
            myReaction: reactionMap[String(c._id)] ?? null,
        }));
        res.status(200).json({ success: true, comments: final });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getComments = getComments;
// POST /feed/:id/share
const sharePost = async (req, res) => {
    try {
        const post = await post_model_1.Post.findByIdAndUpdate(new mongoose_1.Types.ObjectId(req.params.id), { $inc: { sharesCount: 1 } }, { new: true });
        if (!post) {
            res.status(404).json({ success: false, message: 'Post not found' });
            return;
        }
        res.status(200).json({ success: true, sharesCount: post.sharesCount });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.sharePost = sharePost;
// POST /feed/:id/view
// Simple view counter: increments viewsCount by 1 per request.
const viewPost = async (req, res) => {
    try {
        const post = await post_model_1.Post.findByIdAndUpdate(new mongoose_1.Types.ObjectId(req.params.id), { $inc: { viewsCount: 1 } }, { new: true });
        if (!post) {
            res.status(404).json({ success: false, message: 'Post not found' });
            return;
        }
        res.status(200).json({ success: true, viewsCount: post.viewsCount });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.viewPost = viewPost;
// POST /feed/:id/comments
const addComment = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const { text } = req.body;
        if (!text) {
            res.status(400).json({ success: false, message: 'text is required' });
            return;
        }
        const user = await user_model_1.User.findById(req.user.id).select('username profilePic activeFrameId');
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
        const comment = await comment_model_1.Comment.create({
            postId: new mongoose_1.Types.ObjectId(req.params.id),
            userId: new mongoose_1.Types.ObjectId(req.user.id),
            username: user.username,
            userProfilePic: user.profilePic,
            text,
        });
        const updatedPost = await post_model_1.Post.findByIdAndUpdate(new mongoose_1.Types.ObjectId(req.params.id), { $inc: { commentsCount: 1 } }, { new: true }).select('commentsCount').lean();
        // Resolve commenter's active frame for the response
        let activeFrameUrl = '';
        let activeFrameScale = 0.60;
        const activeFrameId = user.activeFrameId;
        if (activeFrameId) {
            try {
                const { Frame } = await Promise.resolve().then(() => __importStar(require('../frames/frame.model')));
                const frame = await Frame.findById(activeFrameId).select('imageUrl avatarScale').lean();
                if (frame) {
                    activeFrameUrl = frame.imageUrl ?? '';
                    activeFrameScale = frame.avatarScale ?? 0.60;
                }
            }
            catch (_) { }
        }
        // ── Notify post owner (skip self-comments) ──
        const parentPost = await post_model_1.Post.findById(req.params.id).select('userId thumbnailUrl videoUrl').lean();
        const ownerId = parentPost?.userId?.toString();
        if (ownerId && ownerId !== req.user.id) {
            (0, notification_service_1.createAndSend)({
                recipientId: ownerId,
                actorId: req.user.id,
                actorUsername: user.username,
                actorProfilePic: user.profilePic ?? '',
                type: 'post_comment',
                payload: notification_service_1.NotificationTriggers.postCommented(user.username, text),
                referenceId: req.params.id,
            }).catch(() => { });
            // ── Activity inbox ──
            (0, activity_service_1.createActivity)({
                recipientId: ownerId,
                actorId: req.user.id,
                type: 'comment_post',
                postId: req.params.id,
                postThumbnailUrl: parentPost?.thumbnailUrl || parentPost?.videoUrl || '',
                commentText: text.slice(0, 150),
            }).catch(() => { });
        }
        // ── Notify mentioned users ──
        const mentionMatches = text.match(/@([a-zA-Z0-9._]+)/g);
        if (mentionMatches && mentionMatches.length > 0) {
            const usernames = Array.from(new Set(mentionMatches.map((m) => m.slice(1).toLowerCase())));
            const mentionedUsers = await user_model_1.User.find({ username: { $in: usernames.map(u => new RegExp(`^${u}$`, 'i')) } }).select('_id username').lean();
            for (const u of mentionedUsers) {
                if (u._id.toString() !== req.user.id) {
                    (0, notification_service_1.createAndSend)({
                        recipientId: u._id.toString(),
                        actorId: req.user.id,
                        actorUsername: user.username,
                        actorProfilePic: user.profilePic ?? '',
                        type: 'user_mention',
                        payload: {
                            title: `@${user.username} mentioned you in a comment`,
                            body: `@${user.username}: ${text.slice(0, 100)}`,
                            data: { type: 'user_mention', postId: req.params.id },
                        },
                        referenceId: req.params.id,
                    }).catch(() => { });
                    // ── Activity inbox ──
                    (0, activity_service_1.createActivity)({
                        recipientId: u._id.toString(),
                        actorId: req.user.id,
                        type: 'mention',
                        postId: req.params.id,
                        commentText: text.slice(0, 150),
                    }).catch(() => { });
                }
            }
        }
        res.status(201).json({
            success: true,
            commentsCount: updatedPost?.commentsCount ?? 0,
            comment: {
                ...(comment.toObject?.() ?? comment),
                activeFrameUrl,
                activeFrameScale,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.addComment = addComment;
// DELETE /feed/:id  — permanently delete own post
const deletePost = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const post = await post_model_1.Post.findById(req.params.id);
        if (!post) {
            res.status(404).json({ success: false, message: 'Post not found' });
            return;
        }
        if (String(post.userId) !== String(req.user.id)) {
            res.status(403).json({ success: false, message: 'Forbidden: not your post' });
            return;
        }
        await post_model_1.Post.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: 'Post deleted' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.deletePost = deletePost;
// PATCH /feed/:id/archive  — archive own post (hide from profile)
const archivePost = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const post = await post_model_1.Post.findById(req.params.id);
        if (!post) {
            res.status(404).json({ success: false, message: 'Post not found' });
            return;
        }
        if (String(post.userId) !== String(req.user.id)) {
            res.status(403).json({ success: false, message: 'Forbidden: not your post' });
            return;
        }
        post.isArchived = true;
        await post.save();
        res.status(200).json({ success: true, message: 'Post archived', post });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.archivePost = archivePost;
// PATCH /feed/:id/restore  — restore archived post back to profile
const restorePost = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const post = await post_model_1.Post.findById(req.params.id);
        if (!post) {
            res.status(404).json({ success: false, message: 'Post not found' });
            return;
        }
        if (String(post.userId) !== String(req.user.id)) {
            res.status(403).json({ success: false, message: 'Forbidden: not your post' });
            return;
        }
        post.isArchived = false;
        await post.save();
        res.status(200).json({ success: true, message: 'Post restored', post });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.restorePost = restorePost;
// PATCH /feed/:id  — edit caption / tags / isPublic of own post
const editPost = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const post = await post_model_1.Post.findById(req.params.id);
        if (!post) {
            res.status(404).json({ success: false, message: 'Post not found' });
            return;
        }
        if (String(post.userId) !== String(req.user.id)) {
            res.status(403).json({ success: false, message: 'Forbidden: not your post' });
            return;
        }
        const { caption, tags, isPublic } = req.body;
        if (caption !== undefined)
            post.caption = caption;
        if (tags !== undefined)
            post.tags = tags;
        if (isPublic !== undefined)
            post.isPublic = isPublic;
        await post.save();
        res.status(200).json({ success: true, post });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.editPost = editPost;
// GET /feed/archived  — get current user's archived posts
const getArchivedPosts = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 30;
        const skip = (page - 1) * limit;
        const posts = await post_model_1.Post.find({
            userId: new mongoose_1.Types.ObjectId(req.user.id),
            isArchived: true,
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
        const total = await post_model_1.Post.countDocuments({
            userId: new mongoose_1.Types.ObjectId(req.user.id),
            isArchived: true,
        });
        res.status(200).json({ success: true, posts, pagination: { page, limit, total } });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getArchivedPosts = getArchivedPosts;
// POST /feed/:id/save  — toggle save/unsave a post
const savePost = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const postId = new mongoose_1.Types.ObjectId(req.params.id);
        const userId = new mongoose_1.Types.ObjectId(req.user.id);
        const existing = await post_save_model_1.PostSave.findOne({ postId, userId });
        let isSaved;
        if (existing) {
            await post_save_model_1.PostSave.deleteOne({ _id: existing._id });
            isSaved = false;
            // Remove save activity on unsave
            const unsavedPost = await post_model_1.Post.findById(postId).select('userId').lean();
            if (unsavedPost?.userId && String(unsavedPost.userId) !== req.user.id) {
                (0, activity_service_1.removeActivity)({
                    type: 'save_post',
                    actorId: req.user.id,
                    recipientId: String(unsavedPost.userId),
                    postId: String(postId),
                }).catch(() => { });
            }
        }
        else {
            await post_save_model_1.PostSave.create({ postId, userId });
            isSaved = true;
            // ── Notify post owner (skip self-saves) ──
            const savedPost = await post_model_1.Post.findById(postId).select('userId thumbnailUrl videoUrl').lean();
            const ownerId = savedPost?.userId?.toString();
            if (ownerId && ownerId !== req.user.id) {
                const actor = await user_model_1.User.findById(req.user.id).select('username profilePic').lean();
                (0, notification_service_1.createAndSend)({
                    recipientId: ownerId,
                    actorId: req.user.id,
                    actorUsername: actor?.username ?? '',
                    actorProfilePic: actor?.profilePic ?? '',
                    type: 'post_save',
                    payload: notification_service_1.NotificationTriggers.postSaved(actor?.username ?? ''),
                    referenceId: String(postId),
                }).catch(() => { });
                // ── Activity inbox ──
                (0, activity_service_1.createActivity)({
                    recipientId: ownerId,
                    actorId: req.user.id,
                    type: 'save_post',
                    postId: String(postId),
                    postThumbnailUrl: savedPost?.thumbnailUrl || savedPost?.videoUrl || '',
                }).catch(() => { });
            }
        }
        res.status(200).json({ success: true, isSaved });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.savePost = savePost;
// GET /feed/saved  — get current user's saved posts
const getSavedPosts = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 30;
        const skip = (page - 1) * limit;
        const saves = await post_save_model_1.PostSave.find({ userId: new mongoose_1.Types.ObjectId(req.user.id) })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select('postId')
            .lean();
        const postIds = saves.map(s => s.postId);
        const posts = await post_model_1.Post.find({ _id: { $in: postIds }, isArchived: { $ne: true } }).lean();
        // Preserve save order
        const postMap = new Map(posts.map(p => [String(p._id), { ...p, isSaved: true }]));
        const orderedPosts = postIds.map(id => postMap.get(String(id))).filter(Boolean);
        res.status(200).json({ success: true, posts: orderedPosts });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getSavedPosts = getSavedPosts;
// POST /feed/:id/report — User reports a video with category & optional description
const reportPost = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const { category, description } = req.body;
        if (!category) {
            res.status(400).json({ success: false, message: 'Category is required' });
            return;
        }
        const postId = new mongoose_1.Types.ObjectId(req.params.id);
        const userId = new mongoose_1.Types.ObjectId(req.user.id);
        const post = await post_model_1.Post.findById(postId);
        if (!post) {
            res.status(404).json({ success: false, message: 'Post not found' });
            return;
        }
        // Check if user already reported this post
        const alreadyReported = post.reports.some(r => r.userId.toString() === req.user.id);
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
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.reportPost = reportPost;
// POST /feed/:id/appeal — Creator appeals video deletion
const appealPost = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const { appealReason } = req.body;
        if (!appealReason || !appealReason.trim()) {
            res.status(400).json({ success: false, message: 'Appeal reason is required' });
            return;
        }
        const post = await post_model_1.Post.findById(req.params.id);
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
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.appealPost = appealPost;
// GET /feed/public — Public feed of uploaded user shorts/videos for web portal
const getPublicFeed = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 30;
        const skip = (page - 1) * limit;
        // Exclude posts from private accounts in the global public feed
        const privateUserIds = await user_model_1.User.find({ isPrivate: true }).select('_id').lean();
        const privateIds = privateUserIds.map((u) => u._id);
        const filter = {
            isPublic: true,
            isArchived: { $ne: true },
            isDeleted: { $ne: true },
            ...(privateIds.length > 0 ? { userId: { $nin: privateIds } } : {}),
        };
        const posts = await post_model_1.Post.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('userId', 'profilePic')
            .lean();
        const enrichedPosts = posts.map(post => {
            const p = { ...post };
            if (post.userId && typeof post.userId === 'object') {
                p.userProfilePic = post.userId.profilePic || post.userProfilePic;
                p.userId = post.userId._id;
            }
            return p;
        });
        const total = await post_model_1.Post.countDocuments(filter);
        res.status(200).json({
            success: true,
            posts: enrichedPosts,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getPublicFeed = getPublicFeed;
// POST /feed/:id/repost — Repost video to current user profile feed
// body: { note?: string }
const repostPost = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const originalPost = await post_model_1.Post.findById(req.params.id);
        if (!originalPost) {
            res.status(404).json({ success: false, message: 'Post not found' });
            return;
        }
        const user = await user_model_1.User.findById(req.user.id).select('username profilePic');
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
        // Optional note attached to the repost
        const note = req.body?.note?.trim() ?? '';
        // Increment share/repost count on original
        await post_model_1.Post.findByIdAndUpdate(req.params.id, { $inc: { sharesCount: 1 } });
        // Build caption: if note provided use it, otherwise default label
        const caption = note
            ? note
            : `Reposted from @${originalPost.username}: ${originalPost.caption}`;
        // Create a repost under the current user's account
        const reposted = await post_model_1.Post.create({
            userId: new mongoose_1.Types.ObjectId(req.user.id),
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
        if (originalOwnerId && originalOwnerId !== req.user.id) {
            (0, activity_service_1.createActivity)({
                recipientId: originalOwnerId,
                actorId: req.user.id,
                type: 'repost_post',
                postId: String(originalPost._id),
                postThumbnailUrl: originalPost.thumbnailUrl || originalPost.videoUrl || '',
            }).catch(() => { });
        }
        res.status(201).json({
            success: true,
            message: 'Post reposted to your profile',
            post: reposted,
            note,
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.repostPost = repostPost;
// POST /feed/:id/pin — Pin post to profile top
const pinPost = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const post = await post_model_1.Post.findById(req.params.id);
        if (!post) {
            res.status(404).json({ success: false, message: 'Post not found' });
            return;
        }
        post.isPinned = true;
        await post.save();
        res.status(200).json({ success: true, message: 'Post pinned', post });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.pinPost = pinPost;
// POST /feed/:id/unpin — Unpin post
const unpinPost = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const post = await post_model_1.Post.findById(req.params.id);
        if (!post) {
            res.status(404).json({ success: false, message: 'Post not found' });
            return;
        }
        post.isPinned = false;
        await post.save();
        res.status(200).json({ success: true, message: 'Post unpinned', post });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.unpinPost = unpinPost;
// ─────────────────────────────────────────────────────────────────────────────
// POST /feed/:id/comments/:commentId/react  — like or dislike a comment
// body: { reaction: 'like' | 'dislike' }
// ─────────────────────────────────────────────────────────────────────────────
const reactToComment = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const { commentId } = req.params;
        const { reaction } = req.body;
        if (reaction !== 'like' && reaction !== 'dislike') {
            res.status(400).json({ success: false, message: "reaction must be 'like' or 'dislike'" });
            return;
        }
        const commentObjId = new mongoose_1.Types.ObjectId(commentId);
        const userObjId = new mongoose_1.Types.ObjectId(req.user.id);
        const comment = await comment_model_1.Comment.findById(commentObjId);
        if (!comment) {
            res.status(404).json({ success: false, message: 'Comment not found' });
            return;
        }
        const existing = await comment_like_model_1.CommentLike.findOne({ commentId: commentObjId, userId: userObjId });
        if (existing) {
            if (existing.reaction === reaction) {
                // Toggle off — remove the reaction
                await comment_like_model_1.CommentLike.deleteOne({ _id: existing._id });
                const field = reaction === 'like' ? 'likesCount' : 'dislikesCount';
                await comment_model_1.Comment.findByIdAndUpdate(commentObjId, { $inc: { [field]: -1 } });
                const updated = await comment_model_1.Comment.findById(commentObjId).select('likesCount dislikesCount').lean();
                res.status(200).json({ success: true, reaction: null, ...updated });
            }
            else {
                // Switch reaction
                const oldField = existing.reaction === 'like' ? 'likesCount' : 'dislikesCount';
                const newField = reaction === 'like' ? 'likesCount' : 'dislikesCount';
                existing.reaction = reaction;
                await existing.save();
                await comment_model_1.Comment.findByIdAndUpdate(commentObjId, {
                    $inc: { [oldField]: -1, [newField]: 1 },
                });
                const updated = await comment_model_1.Comment.findById(commentObjId).select('likesCount dislikesCount').lean();
                res.status(200).json({ success: true, reaction, ...updated });
            }
        }
        else {
            // New reaction
            await comment_like_model_1.CommentLike.create({ commentId: commentObjId, userId: userObjId, reaction });
            const field = reaction === 'like' ? 'likesCount' : 'dislikesCount';
            await comment_model_1.Comment.findByIdAndUpdate(commentObjId, { $inc: { [field]: 1 } });
            const updated = await comment_model_1.Comment.findById(commentObjId).select('likesCount dislikesCount').lean();
            // ── Activity inbox: notify comment author on like (not dislike) ──
            if (reaction === 'like') {
                const commentAuthorId = comment.userId?.toString();
                if (commentAuthorId && commentAuthorId !== req.user.id) {
                    (0, activity_service_1.createActivity)({
                        recipientId: commentAuthorId,
                        actorId: req.user.id,
                        type: 'like_comment',
                        commentId: String(commentObjId),
                        commentText: comment.text?.slice(0, 150) ?? '',
                    }).catch(() => { });
                }
            }
            res.status(200).json({ success: true, reaction, ...updated });
        }
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.reactToComment = reactToComment;
// ─────────────────────────────────────────────────────────────────────────────
// POST /feed/:id/comments/:commentId/replies  — reply to a comment
// body: { text: string }
// ─────────────────────────────────────────────────────────────────────────────
const replyToComment = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const { text } = req.body;
        if (!text) {
            res.status(400).json({ success: false, message: 'text is required' });
            return;
        }
        const { commentId } = req.params;
        const parent = await comment_model_1.Comment.findById(commentId);
        if (!parent) {
            res.status(404).json({ success: false, message: 'Parent comment not found' });
            return;
        }
        const user = await user_model_1.User.findById(req.user.id).select('username profilePic activeFrameId');
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
        const reply = await comment_model_1.Comment.create({
            postId: parent.postId,
            userId: new mongoose_1.Types.ObjectId(req.user.id),
            username: user.username,
            userProfilePic: user.profilePic,
            text,
            parentCommentId: parent._id,
        });
        // Increment the post's commentsCount for replies too
        await post_model_1.Post.findByIdAndUpdate(parent.postId, { $inc: { commentsCount: 1 } });
        // Resolve active frame
        let activeFrameUrl = '';
        let activeFrameScale = 0.60;
        const activeFrameId = user.activeFrameId;
        if (activeFrameId) {
            try {
                const { Frame } = await Promise.resolve().then(() => __importStar(require('../frames/frame.model')));
                const frame = await Frame.findById(activeFrameId).select('imageUrl avatarScale').lean();
                if (frame) {
                    activeFrameUrl = frame.imageUrl ?? '';
                    activeFrameScale = frame.avatarScale ?? 0.60;
                }
            }
            catch (_) { }
        }
        // ── Activity inbox: notify parent comment author on reply ──
        const parentAuthorId = parent.userId?.toString();
        if (parentAuthorId && parentAuthorId !== req.user.id) {
            (0, activity_service_1.createActivity)({
                recipientId: parentAuthorId,
                actorId: req.user.id,
                type: 'reply_comment',
                postId: String(parent.postId),
                commentId: String(parent._id),
                commentText: text.slice(0, 150),
            }).catch(() => { });
        }
        res.status(201).json({
            success: true,
            reply: {
                ...(reply.toObject?.() ?? reply),
                activeFrameUrl,
                activeFrameScale,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.replyToComment = replyToComment;
// ─────────────────────────────────────────────────────────────────────────────
// GET /feed/:id/comments/:commentId/replies  — fetch replies for a comment
// ─────────────────────────────────────────────────────────────────────────────
const getReplies = async (req, res) => {
    try {
        const { commentId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const replies = await comment_model_1.Comment.find({ parentCommentId: new mongoose_1.Types.ObjectId(commentId) })
            .sort({ createdAt: 1 })
            .skip(skip)
            .limit(limit)
            .lean();
        // Attach user's reactions if authenticated
        let reactionMap = {};
        if (req.user) {
            const replyIds = replies.map((r) => r._id);
            const reactions = await comment_like_model_1.CommentLike.find({
                commentId: { $in: replyIds },
                userId: new mongoose_1.Types.ObjectId(req.user.id),
            }).select('commentId reaction').lean();
            for (const r of reactions) {
                reactionMap[r.commentId.toString()] = r.reaction;
            }
        }
        const enriched = replies.map((r) => ({
            ...r,
            myReaction: reactionMap[r._id.toString()] ?? null,
        }));
        res.status(200).json({ success: true, replies: enriched });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getReplies = getReplies;
// ─────────────────────────────────────────────────────────────────────────────
// GET /feed/:id/reposts  — fetch all reposts (with notes) for a post
// ─────────────────────────────────────────────────────────────────────────────
const getReposts = async (req, res) => {
    try {
        const postId = req.params.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        // All posts that are reposts of this original
        const reposts = await post_model_1.Post.find({
            originalPostId: new mongoose_1.Types.ObjectId(postId),
            isDeleted: { $ne: true },
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select('userId username userProfilePic caption createdAt likesCount')
            .lean();
        const total = await post_model_1.Post.countDocuments({
            originalPostId: new mongoose_1.Types.ObjectId(postId),
            isDeleted: { $ne: true },
        });
        // Attach isLiked for current user if authenticated
        let likedSet = new Set();
        if (req.user && reposts.length > 0) {
            const repostIds = reposts.map((r) => r._id);
            const likes = await (await Promise.resolve().then(() => __importStar(require('./post_like.model')))).PostLike
                .find({ userId: new mongoose_1.Types.ObjectId(req.user.id), postId: { $in: repostIds } })
                .select('postId')
                .lean();
            likedSet = new Set(likes.map((l) => String(l.postId)));
        }
        // Check if viewer follows these users
        let followingSet = new Set();
        if (req.user && reposts.length > 0) {
            const { Follow } = await Promise.resolve().then(() => __importStar(require('../auth/follow.model')));
            const follows = await Follow.find({
                followerId: new mongoose_1.Types.ObjectId(req.user.id),
                followingId: { $in: reposts.map((r) => r.userId) },
            }).select('followingId').lean();
            followingSet = new Set(follows.map((f) => String(f.followingId)));
        }
        const enriched = reposts.map((r) => ({
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
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getReposts = getReposts;
// ─────────────────────────────────────────────────────────────────────────────
// DELETE /feed/:id/reposts/:repostId  — delete own repost note
// ─────────────────────────────────────────────────────────────────────────────
const deleteRepost = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const { repostId } = req.params;
        const repost = await post_model_1.Post.findById(repostId);
        if (!repost) {
            res.status(404).json({ success: false, message: 'Repost not found' });
            return;
        }
        if (String(repost.userId) !== req.user.id) {
            res.status(403).json({ success: false, message: 'Not authorized' });
            return;
        }
        // Decrement sharesCount on original
        if (repost.originalPostId) {
            await post_model_1.Post.findByIdAndUpdate(repost.originalPostId, { $inc: { sharesCount: -1 } });
        }
        await post_model_1.Post.findByIdAndDelete(repostId);
        res.status(200).json({ success: true, message: 'Repost deleted' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.deleteRepost = deleteRepost;
// ── Not Interested Endpoint ──────────────────────────────────────────────────
const markNotInterested = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const { id } = req.params;
        const post = await post_model_1.Post.findById(id).select('userId');
        if (!post) {
            res.status(404).json({ success: false, message: 'Post not found.' });
            return;
        }
        await user_model_1.User.findByIdAndUpdate(req.user.id, {
            $addToSet: {
                notInterestedPosts: post._id,
                notInterestedAuthors: post.userId,
            },
        });
        res.status(200).json({ success: true, message: 'Post marked as not interested.' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.markNotInterested = markNotInterested;
// ── Promotion Packages Endpoint (User / App) ──────────────────────────────────
const getPromotionPackages = async (req, res) => {
    try {
        const user = req.user ? await user_model_1.User.findById(req.user.id).select('beanWallet').lean() : null;
        const currentBeans = user?.beanWallet ?? 0;
        // Auto-seed default packages if none exist yet in DB
        const count = await promotion_model_1.PromotionPackage.countDocuments();
        if (count === 0) {
            await promotion_model_1.PromotionPackage.insertMany([
                {
                    name: 'Starter Boost',
                    goal: 'views',
                    beansCost: 100,
                    estimatedReach: 1000,
                    durationDays: 1,
                    badgeText: 'Quick Test',
                    description: '~ 1,000 targeted views in 24 hours',
                    isActive: true,
                    sortOrder: 1,
                },
                {
                    name: 'Growing Creator',
                    goal: 'views',
                    beansCost: 300,
                    estimatedReach: 3500,
                    durationDays: 2,
                    badgeText: 'Trending',
                    description: '~ 3,500 targeted views in 48 hours',
                    isActive: true,
                    sortOrder: 2,
                },
                {
                    name: 'Popular Boost',
                    goal: 'views',
                    beansCost: 500,
                    estimatedReach: 6000,
                    durationDays: 3,
                    badgeText: 'Most Popular',
                    description: '~ 6,000 views + algorithm priority feed',
                    isActive: true,
                    sortOrder: 3,
                },
                {
                    name: 'Superstar Boost',
                    goal: 'views',
                    beansCost: 1000,
                    estimatedReach: 15000,
                    durationDays: 5,
                    badgeText: 'Best Value',
                    description: '~ 15,000 high-engagement video views',
                    isActive: true,
                    sortOrder: 4,
                },
                {
                    name: 'Viral Mega Boost',
                    goal: 'views',
                    beansCost: 2500,
                    estimatedReach: 40000,
                    durationDays: 7,
                    badgeText: 'VIP Spotlight',
                    description: '~ 40,000 views + top trending feed recommendation',
                    isActive: true,
                    sortOrder: 5,
                },
            ]);
        }
        const packages = await promotion_model_1.PromotionPackage.find({ isActive: true })
            .sort({ sortOrder: 1, beansCost: 1 })
            .lean();
        res.status(200).json({
            success: true,
            currentBeans,
            packages,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getPromotionPackages = getPromotionPackages;
// ── Promote Post Endpoint ────────────────────────────────────────────────────
const promotePost = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const { id } = req.params;
        const { packageId, goal = 'views', beans = 500 } = req.body;
        let beansCost = Number(beans) || 500;
        let targetCount = beansCost * 10;
        let selectedGoal = goal;
        if (packageId) {
            const pkg = await promotion_model_1.PromotionPackage.findById(packageId);
            if (pkg) {
                beansCost = pkg.beansCost;
                targetCount = pkg.estimatedReach;
                selectedGoal = pkg.goal;
            }
        }
        else {
            if (beansCost >= 2500)
                targetCount = 40000;
            else if (beansCost >= 1000)
                targetCount = 15000;
            else if (beansCost >= 500)
                targetCount = 6000;
            else if (beansCost >= 300)
                targetCount = 3500;
            else
                targetCount = 1000;
        }
        const user = await user_model_1.User.findById(req.user.id);
        if (!user || (user.beanWallet ?? 0) < beansCost) {
            res.status(400).json({
                success: false,
                message: `Insufficient Beans balance (${user?.beanWallet ?? 0}). Need at least ${beansCost} Beans.`,
            });
            return;
        }
        const post = await post_model_1.Post.findById(id);
        if (!post) {
            res.status(404).json({ success: false, message: 'Post not found.' });
            return;
        }
        // Deduct beans from user beanWallet
        user.beanWallet = (user.beanWallet ?? 0) - beansCost;
        await user.save();
        const campaign = await promotion_model_1.PromotionCampaign.create({
            promoterId: req.user.id,
            postId: post._id,
            goal: selectedGoal,
            beansCost,
            targetCount,
            deliveredCount: 0,
            status: 'active',
        });
        post.isPromoted = true;
        post.promotionBoost = (post.promotionBoost || 0) + 15;
        await post.save();
        res.status(200).json({
            success: true,
            message: 'Video promotion campaign activated successfully!',
            campaign,
            remainingBeans: user.beanWallet,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.promotePost = promotePost;
// ── Company Admin Promotion Endpoints ─────────────────────────────────────────
// GET /api/feed/admin/promotions/packages
const getAdminPromotionPackages = async (_req, res) => {
    try {
        const packages = await promotion_model_1.PromotionPackage.find().sort({ sortOrder: 1, beansCost: 1 }).lean();
        res.status(200).json({ success: true, packages });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getAdminPromotionPackages = getAdminPromotionPackages;
// POST /api/feed/admin/promotions/packages
const createAdminPromotionPackage = async (req, res) => {
    try {
        const { name, goal, beansCost, estimatedReach, durationDays, badgeText, description, isActive, sortOrder } = req.body;
        if (!name || beansCost == null || estimatedReach == null) {
            res.status(400).json({ success: false, message: 'name, beansCost, and estimatedReach are required.' });
            return;
        }
        const pkg = await promotion_model_1.PromotionPackage.create({
            name,
            goal: goal || 'views',
            beansCost: Number(beansCost),
            estimatedReach: Number(estimatedReach),
            durationDays: Number(durationDays) || 1,
            badgeText: badgeText || '',
            description: description || '',
            isActive: isActive !== false,
            sortOrder: Number(sortOrder) || 0,
        });
        res.status(201).json({ success: true, package: pkg });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.createAdminPromotionPackage = createAdminPromotionPackage;
// PUT /api/feed/admin/promotions/packages/:id
const updateAdminPromotionPackage = async (req, res) => {
    try {
        const { id } = req.params;
        const pkg = await promotion_model_1.PromotionPackage.findByIdAndUpdate(id, { $set: req.body }, { new: true });
        if (!pkg) {
            res.status(404).json({ success: false, message: 'Promotion package not found.' });
            return;
        }
        res.status(200).json({ success: true, package: pkg });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateAdminPromotionPackage = updateAdminPromotionPackage;
// DELETE /api/feed/admin/promotions/packages/:id
const deleteAdminPromotionPackage = async (req, res) => {
    try {
        const { id } = req.params;
        await promotion_model_1.PromotionPackage.findByIdAndDelete(id);
        res.status(200).json({ success: true, message: 'Promotion package deleted successfully.' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.deleteAdminPromotionPackage = deleteAdminPromotionPackage;
// GET /api/feed/admin/promotions/campaigns
const getAdminPromotionCampaigns = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const filter = {};
        if (req.query.status && req.query.status !== 'all') {
            filter.status = req.query.status;
        }
        const [campaigns, total] = await Promise.all([
            promotion_model_1.PromotionCampaign.find(filter)
                .populate('promoterId', 'username displayName profilePic email')
                .populate('postId', 'caption videoUrl thumbnailUrl viewsCount likesCount isPromoted')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            promotion_model_1.PromotionCampaign.countDocuments(filter),
        ]);
        res.status(200).json({
            success: true,
            campaigns,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getAdminPromotionCampaigns = getAdminPromotionCampaigns;
// PATCH /api/feed/admin/promotions/campaigns/:id/status
const updateAdminCampaignStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!['active', 'paused', 'completed'].includes(status)) {
            res.status(400).json({ success: false, message: 'Invalid status value.' });
            return;
        }
        const campaign = await promotion_model_1.PromotionCampaign.findByIdAndUpdate(id, { $set: { status } }, { new: true });
        if (!campaign) {
            res.status(404).json({ success: false, message: 'Campaign not found.' });
            return;
        }
        res.status(200).json({ success: true, campaign });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateAdminCampaignStatus = updateAdminCampaignStatus;
// GET /api/feed/admin/promotions/stats
const getAdminPromotionStats = async (_req, res) => {
    try {
        const [totalCampaigns, activeCampaigns, aggregates, totalPackages] = await Promise.all([
            promotion_model_1.PromotionCampaign.countDocuments(),
            promotion_model_1.PromotionCampaign.countDocuments({ status: 'active' }),
            promotion_model_1.PromotionCampaign.aggregate([
                {
                    $group: {
                        _id: null,
                        totalBeansSpent: { $sum: '$beansCost' },
                        totalDeliveredViews: { $sum: '$deliveredCount' },
                        totalTargetReach: { $sum: '$targetCount' },
                    },
                },
            ]),
            promotion_model_1.PromotionPackage.countDocuments({ isActive: true }),
        ]);
        const agg = aggregates[0] || { totalBeansSpent: 0, totalDeliveredViews: 0, totalTargetReach: 0 };
        res.status(200).json({
            success: true,
            stats: {
                totalCampaigns,
                activeCampaigns,
                totalBeansSpent: agg.totalBeansSpent,
                totalDeliveredViews: agg.totalDeliveredViews,
                totalTargetReach: agg.totalTargetReach,
                totalPackages,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getAdminPromotionStats = getAdminPromotionStats;
