"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listGames = listGames;
exports.getGame = getGame;
exports.updateGame = updateGame;
exports.getGameStats = getGameStats;
const game_config_model_1 = require("../game/game-config.model");
const wallet_transaction_model_1 = __importDefault(require("../wallet/wallet.transaction.model"));
const activity_log_service_1 = require("../activity-log/activity-log.service");
const BUILTIN_GAMES = [
    { gameId: 'spin', name: 'Lucky Spin', description: 'Daily spin wheel for diamonds' },
    { gameId: 'teen_patti', name: 'Teen Patti', description: '3-card poker vs dealer. Bet 10–500 💎' },
    { gameId: 'dice', name: 'Dice Roll', description: 'Roll 2 dice — Over/Under/Exact. Bet 10–500 💎' },
    { gameId: 'plinko', name: 'Plinko', description: 'Drop a ball through pegs. Bet 10–500 💎' },
];
async function listGames(_req, res) {
    try {
        const configs = await game_config_model_1.GameConfig.find().lean();
        const merged = BUILTIN_GAMES.map(g => ({
            ...g,
            ...(configs.find(c => c.gameId === g.gameId) || { enabled: true }),
        }));
        res.json({ success: true, data: merged });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function getGame(req, res) {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        if (!id) {
            return res.status(400).json({ success: false, message: 'Game id is required' });
        }
        const builtin = BUILTIN_GAMES.find(g => g.gameId === id);
        const config = await game_config_model_1.GameConfig.findOne({ gameId: id }).lean();
        if (!builtin && !config)
            return res.status(404).json({ success: false, message: 'Game not found' });
        res.json({ success: true, data: { ...(builtin || {}), ...(config || {}) } });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function updateGame(req, res) {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        if (!id) {
            return res.status(400).json({ success: false, message: 'Game id is required' });
        }
        const { enabled, name, meta } = req.body;
        const adminUser = req.adminUser;
        const cfg = await game_config_model_1.GameConfig.findOneAndUpdate({ gameId: id }, { $set: { ...(name !== undefined && { name }), ...(enabled !== undefined && { enabled }), ...(meta !== undefined && { meta }) } }, { upsert: true, new: true });
        await (0, activity_log_service_1.logActivity)({
            actorId: adminUser?.id, actorRole: adminUser?.role || 'company_admin',
            actionType: 'update_game', targetEntityType: 'GameConfig', targetEntityId: String(id),
            description: `Updated game "${id}" config`,
        });
        res.json({ success: true, data: cfg });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function getGameStats(_req, res) {
    try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
        const txAgg = await wallet_transaction_model_1.default.aggregate([
            { $match: { createdAt: { $gte: thirtyDaysAgo } } },
            {
                $group: {
                    _id: '$type',
                    totalAmount: { $sum: '$amount' },
                    count: { $sum: 1 },
                },
            },
        ]);
        res.json({ success: true, data: { txSummary: txAgg, note: 'Full game stats available after third-party API integration' } });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
exports.default = {};
