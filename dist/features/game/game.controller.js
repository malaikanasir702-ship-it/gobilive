"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSpinConfig = exports.spinWheel = void 0;
const user_model_1 = require("../auth/user.model");
const crypto_1 = __importDefault(require("crypto"));
const SPIN_COST = 10;
const FREE_SPIN_COOLDOWN_HOURS = 24;
const PRIZES = [
    { label: '5 🫘 Beans', beans: 5, weight: 28 },
    { label: '10 🫘 Beans', beans: 10, weight: 22 },
    { label: '20 🫘 Beans', beans: 20, weight: 14 },
    { label: '50 🫘 Beans', beans: 50, weight: 8 },
    { label: '100 🫘 Beans', beans: 100, weight: 3 },
    { label: 'Better luck next time', beans: 0, weight: 25 },
];
function pickPrize() {
    const total = PRIZES.reduce((s, p) => s + p.weight, 0);
    // Secure random selection (avoids Math.random bias/predictability)
    let r = crypto_1.default.randomInt(0, total);
    for (const p of PRIZES) {
        r -= p.weight;
        if (r <= 0)
            return p;
    }
    return PRIZES[0];
}
function getNextFreeSpinAt(lastFreeSpinAt) {
    if (!lastFreeSpinAt)
        return new Date(0);
    const next = new Date(lastFreeSpinAt);
    next.setHours(next.getHours() + FREE_SPIN_COOLDOWN_HOURS);
    return next;
}
const spinWheel = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const user = await user_model_1.User.findById(req.user.id);
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        const now = new Date();
        const nextFreeSpinAt = getNextFreeSpinAt(user.lastFreeSpinAt);
        const freeSpinAvailable = !user.lastFreeSpinAt || nextFreeSpinAt <= now;
        const cost = freeSpinAvailable ? 0 : SPIN_COST;
        if ((user.rcoins ?? 0) < cost) {
            res.status(400).json({ success: false, message: `Need ${cost} Beans to spin.` });
            return;
        }
        if (cost > 0)
            user.rcoins -= cost;
        const prize = pickPrize();
        user.rcoins += prize.beans;
        if (freeSpinAvailable)
            user.lastFreeSpinAt = now;
        await user.save({ validateModifiedOnly: true });
        res.status(200).json({
            success: true,
            spinCost: SPIN_COST,
            costCharged: cost,
            prize: { label: prize.label, beans: prize.beans, diamonds: prize.beans },
            freeSpin: {
                available: freeSpinAvailable,
                nextFreeSpinAt: getNextFreeSpinAt(user.lastFreeSpinAt).toISOString(),
            },
            user: {
                id: user.id,
                rcoins: user.rcoins,
                diamonds: user.diamonds,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.spinWheel = spinWheel;
const getSpinConfig = async (_req, res) => {
    res.status(200).json({
        success: true,
        spinCost: SPIN_COST,
        freeSpinCooldownHours: FREE_SPIN_COOLDOWN_HOURS,
        prizes: PRIZES.map((p) => ({ label: p.label, beans: p.beans, diamonds: p.beans })),
    });
};
exports.getSpinConfig = getSpinConfig;
