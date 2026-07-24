"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useSound = exports.createSound = exports.getSoundById = exports.getSounds = void 0;
const sound_model_1 = require("./sound.model");
// GET /api/sounds
const getSounds = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const genre = req.query.genre;
        const q = req.query.q;
        const filter = { isActive: true };
        if (genre && genre !== 'all')
            filter.genre = genre;
        if (q)
            filter.$text = { $search: q };
        const skip = (page - 1) * limit;
        const [sounds, total] = await Promise.all([
            sound_model_1.Sound.find(filter).sort({ usageCount: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
            sound_model_1.Sound.countDocuments(filter),
        ]);
        res.json({ success: true, sounds, total, page, pages: Math.ceil(total / limit) });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getSounds = getSounds;
// GET /api/sounds/:id
const getSoundById = async (req, res) => {
    try {
        const sound = await sound_model_1.Sound.findById(req.params.id).lean();
        if (!sound)
            return res.status(404).json({ success: false, message: 'Sound not found' });
        res.json({ success: true, sound });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getSoundById = getSoundById;
// POST /api/sounds — admin only
const createSound = async (req, res) => {
    try {
        const sound = await sound_model_1.Sound.create(req.body);
        res.status(201).json({ success: true, sound });
    }
    catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
exports.createSound = createSound;
// POST /api/sounds/:id/use — increment usageCount
const useSound = async (req, res) => {
    try {
        await sound_model_1.Sound.findByIdAndUpdate(req.params.id, { $inc: { usageCount: 1 } });
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.useSound = useSound;
