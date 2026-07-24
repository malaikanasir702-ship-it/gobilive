"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../core/middlewares/auth.middleware");
const game_controller_1 = require("./game.controller");
const teen_patti_controller_1 = require("./teen-patti.controller");
const dice_controller_1 = require("./dice.controller");
const plinko_controller_1 = require("./plinko.controller");
const game_history_model_1 = require("./game-history.model");
const router = (0, express_1.Router)();
// ── Spin Wheel ──────────────────────────────────────────────────────────────
router.get('/spin/config', auth_middleware_1.authenticateJWT, game_controller_1.getSpinConfig);
router.post('/spin', auth_middleware_1.authenticateJWT, game_controller_1.spinWheel);
// ── Teen Patti ──────────────────────────────────────────────────────────────
router.get('/teen-patti/config', auth_middleware_1.authenticateJWT, teen_patti_controller_1.getTeenPattiConfig);
router.post('/teen-patti/play', auth_middleware_1.authenticateJWT, teen_patti_controller_1.playTeenPatti);
// ── Dice Roll ───────────────────────────────────────────────────────────────
router.get('/dice/config', auth_middleware_1.authenticateJWT, dice_controller_1.getDiceConfig);
router.post('/dice/roll', auth_middleware_1.authenticateJWT, dice_controller_1.rollDice);
// ── Plinko ──────────────────────────────────────────────────────────────────
router.get('/plinko/config', auth_middleware_1.authenticateJWT, plinko_controller_1.getPlinkoConfig);
router.post('/plinko/drop', auth_middleware_1.authenticateJWT, plinko_controller_1.dropPlinko);
// ── Game History (all games, paginated) ─────────────────────────────────────
router.get('/history', auth_middleware_1.authenticateJWT, async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const page = Math.max(1, parseInt(String(req.query.page ?? 1)));
        const limit = Math.min(50, parseInt(String(req.query.limit ?? 20)));
        const type = req.query.type;
        const filter = { userId: req.user.id };
        if (type)
            filter.gameType = type;
        const [items, total] = await Promise.all([
            game_history_model_1.GameHistory.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            game_history_model_1.GameHistory.countDocuments(filter),
        ]);
        res.json({ success: true, items, total, page, totalPages: Math.ceil(total / limit) });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
exports.default = router;
