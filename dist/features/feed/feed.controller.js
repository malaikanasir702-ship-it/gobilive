"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicFeed = exports.appealPost = exports.reportPost = exports.getSavedPosts = exports.savePost = exports.getArchivedPosts = exports.editPost = exports.restorePost = exports.archivePost = exports.deletePost = exports.addComment = exports.viewPost = exports.sharePost = exports.getComments = exports.likePost = exports.createPost = exports.getFeed = void 0;
const mongoose_1 = require("mongoose");
const post_model_1 = require("./post.model");
const comment_model_1 = require("./comment.model");
const post_like_model_1 = require("./post_like.model");
const post_save_model_1 = require("./post_save.model");
const user_model_1 = require("../auth/user.model");
const follow_model_1 = require("../auth/follow.model");
const notification_service_1 = require("../notifications/notification.service");
// GET /feed?page=1&limit=10&userId=xxx&likedBy=xxx
const getFeed = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const filter = { isPublic: true, isArchived: { $ne: true }, isDeleted: { $ne: true } };
        if (req.query.userId) {
            filter.userId = new mongoose_1.Types.ObjectId(req.query.userId);
            filter.isArchived = { $ne: true };
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
            // Dynamic liked posts: fetch popular posts with likes
            filter.likesCount = { $gt: 0 };
        }
        else {
            // Global home feed — exclude posts from private accounts entirely
            const privateUserIds = await user_model_1.User.find({ isPrivate: true }).select('_id').lean();
            const privateIds = privateUserIds.map((u) => u._id);
            if (privateIds.length > 0) {
                filter.userId = { $nin: privateIds };
            }
        }
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
            isPublic: isPublic !== false,
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
                    const actor = await user_model_1.User.findById(req.user.id).select('username profilePic').lean();
                    (0, notification_service_1.createAndSend)({
                        recipientId: ownerId,
                        actorId: req.user.id,
                        actorUsername: actor?.username ?? req.user.username,
                        actorProfilePic: actor?.profilePic ?? '',
                        type: 'post_like',
                        payload: notification_service_1.NotificationTriggers.postLiked(actor?.username ?? req.user.username),
                        referenceId: String(postId),
                    }).catch(() => { }); // fire-and-forget
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
        const comments = await comment_model_1.Comment.find({ postId: new mongoose_1.Types.ObjectId(req.params.id) })
            .sort({ createdAt: -1 })
            .limit(50)
            .populate('userId', 'profilePic')
            .lean();
        const enrichedComments = comments.map(comment => {
            const c = { ...comment };
            if (comment.userId && typeof comment.userId === 'object') {
                c.userProfilePic = comment.userId.profilePic || comment.userProfilePic;
                c.userId = comment.userId._id;
            }
            return c;
        });
        res.status(200).json({ success: true, comments: enrichedComments });
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
        const user = await user_model_1.User.findById(req.user.id).select('username profilePic');
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
        await post_model_1.Post.findByIdAndUpdate(new mongoose_1.Types.ObjectId(req.params.id), { $inc: { commentsCount: 1 } });
        // ── Notify post owner (skip self-comments) ──
        const parentPost = await post_model_1.Post.findById(req.params.id).select('userId').lean();
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
                }
            }
        }
        res.status(201).json({ success: true, comment });
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
        }
        else {
            await post_save_model_1.PostSave.create({ postId, userId });
            isSaved = true;
            // ── Notify post owner (skip self-saves) ──
            const savedPost = await post_model_1.Post.findById(postId).select('userId').lean();
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
