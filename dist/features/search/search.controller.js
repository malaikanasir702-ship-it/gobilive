"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTrendingUsers = exports.clearSearchHistory = exports.getSearchHistory = exports.searchUsers = void 0;
const user_model_1 = require("../auth/user.model");
const searchUsers = async (req, res) => {
    try {
        const q = (req.query.q || '').trim();
        if (!q || q.length < 2) {
            res.status(400).json({ success: false, message: 'Query must be at least 2 characters.' });
            return;
        }
        const users = await user_model_1.User.find({
            username: { $regex: q, $options: 'i' },
        })
            .select('username bio profilePic level isVIP badges followersCount')
            .limit(30)
            .lean();
        if (req.user) {
            await user_model_1.User.findByIdAndUpdate(req.user.id, {
                $push: {
                    searchHistory: {
                        $each: [q],
                        $position: 0,
                        $slice: 20,
                    },
                },
            });
        }
        res.status(200).json({ success: true, users });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.searchUsers = searchUsers;
const getSearchHistory = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const user = await user_model_1.User.findById(req.user.id).select('searchHistory');
        res.status(200).json({ success: true, history: user?.searchHistory ?? [] });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getSearchHistory = getSearchHistory;
const clearSearchHistory = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        await user_model_1.User.findByIdAndUpdate(req.user.id, { searchHistory: [] });
        res.status(200).json({ success: true, message: 'Search history cleared.' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.clearSearchHistory = clearSearchHistory;
const getTrendingUsers = async (_req, res) => {
    try {
        const users = await user_model_1.User.find()
            .sort({ followersCount: -1, level: -1 })
            .select('username bio profilePic level isVIP badges followersCount')
            .limit(20)
            .lean();
        res.status(200).json({ success: true, users });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getTrendingUsers = getTrendingUsers;
