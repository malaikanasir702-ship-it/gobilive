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
exports.updatePrivacySettings = exports.getPrivacySettings = exports.recordProfileView = exports.markOneRead = exports.markAllRead = exports.getUnreadCount = exports.getActivities = void 0;
const activity_service_1 = require("./activity.service");
const user_model_1 = require("../auth/user.model");
// GET /api/activity?filter=all&page=1&limit=20
const getActivities = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const recipientId = req.user.id;
        const filter = req.query.filter || 'all';
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
        const validFilters = [
            'all', 'likes_favorites', 'comments', 'mentions_tags', 'new_followers', 'profile_views',
        ];
        if (!validFilters.includes(filter)) {
            res.status(400).json({ success: false, message: 'Invalid filter.' });
            return;
        }
        const result = await (0, activity_service_1.getActivityFeed)({ recipientId, filter, page, limit });
        res.status(200).json({ success: true, ...result });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};
exports.getActivities = getActivities;
// GET /api/activity/unread-count
const getUnreadCount = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const count = await (0, activity_service_1.getActivityUnreadCount)(req.user.id);
        res.status(200).json({ success: true, unreadCount: count });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};
exports.getUnreadCount = getUnreadCount;
// PATCH /api/activity/read-all
const markAllRead = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        await (0, activity_service_1.markAllActivitiesRead)(req.user.id);
        res.status(200).json({ success: true });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};
exports.markAllRead = markAllRead;
// PATCH /api/activity/:id/read
const markOneRead = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        await (0, activity_service_1.markActivityRead)(req.user.id, String(req.params.id));
        res.status(200).json({ success: true });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};
exports.markOneRead = markOneRead;
// POST /api/activity/profile-view/:userId  — User A views User B's profile
// User B's activity is created only if their privacy setting allows it.
const recordProfileView = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const viewedUserId = String(req.params.userId);
        const viewerId = String(req.user.id);
        if (viewedUserId === viewerId) {
            res.status(200).json({ success: true, message: 'Self-view ignored.' });
            return;
        }
        // Check viewed user's privacy preference
        const viewedUser = await user_model_1.User.findById(viewedUserId)
            .select('profileViewsVisible isTerminated isBlocked')
            .lean();
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
        const { createActivity } = await Promise.resolve().then(() => __importStar(require('./activity.service')));
        await createActivity({
            recipientId: viewedUserId,
            actorId: viewerId,
            type: 'profile_view',
        });
        res.status(200).json({ success: true });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};
exports.recordProfileView = recordProfileView;
// GET /api/activity/privacy-settings
const getPrivacySettings = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const user = await user_model_1.User.findById(req.user.id).select('profileViewsVisible').lean();
        res.status(200).json({
            success: true,
            profileViewsVisible: user?.profileViewsVisible !== false,
        });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};
exports.getPrivacySettings = getPrivacySettings;
// PATCH /api/activity/privacy-settings
const updatePrivacySettings = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const { profileViewsVisible } = req.body;
        if (typeof profileViewsVisible !== 'boolean') {
            res.status(400).json({ success: false, message: 'profileViewsVisible must be a boolean.' });
            return;
        }
        await user_model_1.User.findByIdAndUpdate(req.user.id, { $set: { profileViewsVisible } });
        res.status(200).json({ success: true, profileViewsVisible });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};
exports.updatePrivacySettings = updatePrivacySettings;
