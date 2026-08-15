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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendGiftToHost = exports.purchaseGiftItem = exports.deleteGift = exports.updateGift = exports.uploadSvgaGift = exports.createEmojiGift = exports.getGiftCatalog = exports.svgaUploadMiddleware = exports.requireAdminJwt = void 0;
exports.injectGiftIo = injectGiftIo;
exports.seedGiftCatalogIfEmpty = seedGiftCatalogIfEmpty;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const cloudinary_1 = require("cloudinary");
const gift_model_1 = require("./gift.model");
const gift_config_1 = require("./gift.config");
const leveling_service_1 = require("../auth/leveling.service");
const live_model_1 = __importDefault(require("../live/live.model"));
const user_model_1 = require("../auth/user.model");
// Lazy import to avoid circular deps — seat.controller exports _io via getIo
let _getIo = null;
function injectGiftIo(fn) {
    _getIo = fn;
}
function getIo() { return _getIo?.() ?? null; }
// ─── Admin guard middleware ───────────────────────────────────────────────────
/** Allows only company_admin and super_admin roles (via regular JWT auth). */
const requireAdminJwt = (req, res, next) => {
    const role = req.user?.role;
    const adminRoles = ['company_admin', 'super_admin'];
    if (!role || !adminRoles.includes(role)) {
        res.status(403).json({ success: false, message: 'Admin access required.' });
        return;
    }
    next();
};
exports.requireAdminJwt = requireAdminJwt;
// ─── Multer — temp disk storage for SVGA uploads ────────────────────────────
const _storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, '/tmp'),
    filename: (_req, file, cb) => cb(null, `gift-${Date.now()}${path_1.default.extname(file.originalname)}`),
});
exports.svgaUploadMiddleware = (0, multer_1.default)({
    storage: _storage,
    limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB max
    fileFilter: (_req, file, cb) => {
        // Accept .svga files only
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        if (ext === '.svga' || file.mimetype === 'application/octet-stream') {
            cb(null, true);
        }
        else {
            cb(new Error('Only .svga files are allowed.'));
        }
    },
}).single('file');
// ─── Seed helper — called once on startup if DB is empty ────────────────────
async function seedGiftCatalogIfEmpty() {
    try {
        const { TIKTOK_GIFTS_SEED } = await Promise.resolve().then(() => __importStar(require('../../scripts/seed-tiktok-gifts')));
        for (const g of TIKTOK_GIFTS_SEED) {
            await gift_model_1.Gift.updateOne({ id: g.id }, {
                $set: {
                    ...g,
                    isVipOnly: false,
                    animation: 'float',
                    giftType: 'emoji',
                    isActive: true,
                },
            }, { upsert: true });
        }
        console.log('[Gifts] Seeded TikTok gifts catalog into MongoDB.');
    }
    catch (err) {
        console.warn('[Gifts] Seed skipped:', err.message);
    }
}
// ─── GET /api/gifts/catalog ──────────────────────────────────────────────────
const getGiftCatalog = async (_req, res) => {
    try {
        const gifts = await gift_model_1.Gift.find({ isActive: true }).sort({ sortOrder: 1, createdAt: 1 }).lean();
        // Normalise _id → id for backwards-compat with Flutter (which uses gift['id'])
        const normalised = gifts.map((g) => ({
            id: g.id,
            name: g.name,
            emoji: g.emoji,
            diamondCost: g.diamondCost,
            rcoinEarned: g.rcoinEarned,
            isVipOnly: g.isVipOnly,
            animation: g.animation,
            giftType: g.giftType,
            svgaUrl: g.svgaUrl ?? null,
            isActive: g.isActive,
            sortOrder: g.sortOrder,
        }));
        res.status(200).json({ success: true, gifts: normalised });
    }
    catch (err) {
        console.error('[getGiftCatalog]', err);
        res.status(500).json({ success: false, message: 'Failed to fetch gift catalog.' });
    }
};
exports.getGiftCatalog = getGiftCatalog;
// ─── POST /api/gifts/admin/create  (admin only — creates an emoji gift) ──────
const createEmojiGift = async (req, res) => {
    try {
        const { id, name, emoji, diamondCost, rcoinEarned, isVipOnly, animation, sortOrder } = req.body;
        if (!id || !name || !diamondCost) {
            res.status(400).json({ success: false, message: 'id, name, and diamondCost are required.' });
            return;
        }
        const resolvedGiftType = req.body.giftType === 'svga' ? 'svga' : 'emoji';
        const gift = await gift_model_1.Gift.create({
            id,
            name,
            emoji: emoji ?? '🎁',
            diamondCost: Number(diamondCost),
            rcoinEarned: Number(rcoinEarned ?? 0),
            isVipOnly: Boolean(isVipOnly),
            animation: animation ?? 'float',
            giftType: resolvedGiftType,
            svgaUrl: undefined,
            isActive: true,
            sortOrder: Number(sortOrder ?? 99),
        });
        res.status(201).json({ success: true, gift });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.createEmojiGift = createEmojiGift;
// ─── POST /api/gifts/admin/upload-svga  (admin only — uploads SVGA to Cloudinary) ─
const uploadSvgaGift = async (req, res) => {
    const file = req.file;
    try {
        if (!file) {
            res.status(400).json({ success: false, message: 'No file uploaded.' });
            return;
        }
        const { id, name, emoji, diamondCost, rcoinEarned, isVipOnly, animation, sortOrder } = req.body;
        if (!id || !name || !diamondCost) {
            fs_1.default.unlinkSync(file.path);
            res.status(400).json({ success: false, message: 'id, name, and diamondCost are required.' });
            return;
        }
        // Upload SVGA to Cloudinary as a raw file
        const result = await cloudinary_1.v2.uploader.upload(file.path, {
            folder: 'gobilive_gifts',
            resource_type: 'raw', // .svga is not a standard media type
            public_id: `svga_${id}_${Date.now()}`,
            overwrite: false,
        });
        // Clean up temp file
        try {
            fs_1.default.unlinkSync(file.path);
        }
        catch (_) { }
        // Persist gift record
        const gift = await gift_model_1.Gift.create({
            id,
            name,
            emoji: emoji ?? '🎁',
            diamondCost: Number(diamondCost),
            rcoinEarned: Number(rcoinEarned ?? 0),
            isVipOnly: Boolean(isVipOnly),
            animation: animation ?? 'svga',
            giftType: 'svga',
            svgaUrl: result.secure_url,
            isActive: true,
            sortOrder: Number(sortOrder ?? 99),
        });
        res.status(201).json({ success: true, gift, cloudinaryUrl: result.secure_url });
    }
    catch (err) {
        // Clean up temp file on error
        if (req.file?.path) {
            try {
                fs_1.default.unlinkSync(req.file.path);
            }
            catch (_) { }
        }
        console.error('[uploadSvgaGift]', err);
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.uploadSvgaGift = uploadSvgaGift;
// ─── PATCH /api/gifts/admin/:id  (admin only — toggle active / update fields) ─
const updateGift = async (req, res) => {
    try {
        const { id } = req.params;
        const allowed = ['name', 'emoji', 'diamondCost', 'rcoinEarned', 'isVipOnly', 'animation', 'isActive', 'sortOrder'];
        const updates = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined)
                updates[key] = req.body[key];
        }
        const gift = await gift_model_1.Gift.findOneAndUpdate({ id }, updates, { new: true });
        if (!gift) {
            res.status(404).json({ success: false, message: 'Gift not found.' });
            return;
        }
        res.status(200).json({ success: true, gift });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.updateGift = updateGift;
// ─── DELETE /api/gifts/admin/:id  (admin only — hard delete from DB) ─────────
const deleteGift = async (req, res) => {
    try {
        const { id } = req.params;
        const gift = await gift_model_1.Gift.findOneAndDelete({ id });
        if (!gift) {
            res.status(404).json({ success: false, message: 'Gift not found.' });
            return;
        }
        res.status(200).json({ success: true, message: 'Gift permanently deleted.' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.deleteGift = deleteGift;
// ─── POST /api/gifts/purchase  (buy a cosmetic gift item from store) ─────────
const purchaseGiftItem = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const { giftId, quantity = 1 } = req.body;
        if (!giftId) {
            res.status(400).json({ success: false, message: 'giftId is required.' });
            return;
        }
        // Look up gift — DB first, then static config
        let gift = await gift_model_1.Gift.findOne({ id: giftId, isActive: true }).lean();
        if (!gift) {
            const staticGift = (0, gift_config_1.getGiftById)(giftId);
            if (!staticGift) {
                res.status(400).json({ success: false, message: `Invalid gift id: ${giftId}` });
                return;
            }
            gift = staticGift;
        }
        const safeQty = Math.max(1, Number(quantity));
        const totalCost = gift.diamondCost * safeQty;
        // Deduct diamonds atomically
        const updated = await user_model_1.User.findOneAndUpdate({ _id: req.user.id, diamonds: { $gte: totalCost } }, { $inc: { diamonds: -totalCost } }, { new: true }).select('diamonds rcoins username').lean();
        if (!updated) {
            res.status(400).json({ success: false, message: 'Insufficient diamonds.' });
            return;
        }
        // XP for diamond spend
        try {
            await (0, leveling_service_1.addXpFromDiamondSpend)(req.user.id, totalCost);
        }
        catch (_) { }
        res.status(200).json({
            success: true,
            message: `Successfully purchased ${safeQty}× ${gift.name}!`,
            giftId: gift.id,
            giftName: gift.name,
            quantity: safeQty,
            diamondsSpent: totalCost,
            remainingDiamonds: updated.diamonds,
            user: { diamonds: updated.diamonds, rcoins: updated.rcoins },
        });
    }
    catch (error) {
        console.error('[purchaseGiftItem]', error);
        res.status(500).json({ success: false, message: error.message || 'Purchase failed.' });
    }
};
exports.purchaseGiftItem = purchaseGiftItem;
// ─── POST /api/gifts/send ────────────────────────────────────────────────────
async function processGiftPayment(senderId, hostId, beansCost, beansEarned, _giftName) {
    // Deduct beans atomically without triggering full-document schema validation
    const updatedSender = await user_model_1.User.findOneAndUpdate({ _id: senderId, beanWallet: { $gte: beansCost } }, { $inc: { beanWallet: -beansCost } }, { new: true }).select('beanWallet').lean();
    if (!updatedSender) {
        const sender = await user_model_1.User.findById(senderId).select('beanWallet').lean();
        if (!sender)
            throw new Error('Sender not found.');
        throw new Error('Insufficient beans.');
    }
    // Credit beans to recipient
    if (beansEarned > 0) {
        await user_model_1.User.updateOne({ _id: hostId }, { $inc: { beanWallet: beansEarned } });
    }
}
const sendGiftToHost = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        // ── Gifting suspension check (negative bean balance) ─────────────────────
        const senderProfile = await user_model_1.User.findById(req.user.id).select('isGiftingSuspended').lean();
        if (senderProfile?.isGiftingSuspended) {
            res.status(403).json({
                success: false,
                message: 'Account restricted due to negative balance. Please clear your dues.',
            });
            return;
        }
        // targetUserId — optional: gift a specific seat member instead of host
        const { giftId, channelName, count = 1, targetUserId } = req.body;
        if (!giftId || !channelName) {
            res.status(400).json({ success: false, message: 'giftId and channelName are required.' });
            return;
        }
        // Look up gift from MongoDB first, fall back to static config
        let gift = await gift_model_1.Gift.findOne({ id: giftId, isActive: true }).lean();
        if (!gift) {
            // ── Local TikTok-style assets (id starts with 'local_') ──────────────
            // These gifts are bundled inside the app — no DB entry needed.
            // The client sends the cost; we trust it because Beans are server-verified.
            if (typeof giftId === 'string' && giftId.startsWith('local_')) {
                const clientCost = Math.max(1, Number(req.body.cost ?? req.body.diamondCost ?? 1));
                const rcoin = Math.floor(clientCost * 0.5); // host earns 50% as beans
                const friendlyName = giftId
                    .replace('local_', '')
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, (c) => c.toUpperCase());
                gift = {
                    id: giftId,
                    name: friendlyName,
                    emoji: '🎁',
                    diamondCost: clientCost,
                    rcoinEarned: rcoin,
                    giftType: 'local',
                    svgaUrl: null,
                    animation: 'float',
                };
            }
            else {
                const staticGift = (0, gift_config_1.getGiftById)(giftId);
                if (!staticGift) {
                    res.status(400).json({ success: false, message: `Invalid gift id: ${giftId}` });
                    return;
                }
                gift = { ...staticGift, giftType: 'emoji', svgaUrl: undefined };
            }
        }
        const room = await live_model_1.default.findOne({ channelName });
        if (!room) {
            res.status(404).json({ success: false, message: 'Live room not found.' });
            return;
        }
        const safeCount = Math.max(1, Number(count));
        const totalCost = gift.diamondCost * safeCount; // total Beans cost
        const totalBeansEarned = (gift.rcoinEarned || gift.diamondCost) * safeCount;
        // Determine the actual recipient: targetUserId if provided & valid, else room host
        let recipientId = room.hostId.toString();
        let recipientUsername = room.hostUsername;
        if (targetUserId && targetUserId !== req.user.id) {
            // Validate that the target is actually in a seat in this room
            const targetSeat = room.seats.find((s) => s.userId && s.userId.toString() === targetUserId);
            if (targetSeat) {
                recipientId = targetUserId;
                const targetUser = await user_model_1.User.findById(targetUserId).select('username').lean();
                recipientUsername = targetUser?.username ?? targetSeat.username ?? 'Unknown';
            }
        }
        await processGiftPayment(req.user.id, recipientId, totalCost, totalBeansEarned, gift.name);
        room.totalGifts += safeCount;
        room.totalDiamondsEarned += totalCost;
        await room.save();
        try {
            await (0, leveling_service_1.addXpFromDiamondSpend)(req.user.id, totalCost);
        }
        catch (_) { }
        // Fetch updated balances so the live UI can show them in real-time
        const [senderUpdated, recipientUpdated] = await Promise.all([
            user_model_1.User.findById(req.user.id).select('beanWallet diamonds username').lean(),
            user_model_1.User.findById(recipientId).select('beanWallet diamonds rcoins username').lean(),
        ]);
        // Broadcast balance updates to the live room via Socket.IO
        const io = getIo();
        if (io) {
            // Broadcast gift animation to everyone in the room
            io.to(channelName).emit('gift_received', {
                roomId: channelName,
                sender: req.user.username,
                giftName: gift.name,
                giftId: gift.id, // slug e.g. 'lion', 'car' — used by Flutter matcher
                emoji: gift.emoji,
                giftType: gift.giftType ?? 'emoji',
                svgaUrl: gift.svgaUrl ?? null,
                count: safeCount,
                cost: totalCost,
            });
            // Broadcast bean & diamond balance updates
            const balanceUpdatePayload = {
                roomId: channelName,
                sender: {
                    userId: req.user.id,
                    username: req.user.username,
                    beans: senderUpdated?.beanWallet ?? 0,
                    diamonds: senderUpdated?.diamonds ?? 0,
                },
                recipient: {
                    userId: recipientId,
                    username: recipientUsername,
                    beans: recipientUpdated?.beanWallet ?? 0,
                    diamonds: recipientUpdated?.diamonds ?? 0,
                    rcoins: recipientUpdated?.rcoins ?? 0,
                },
            };
            io.to(channelName).emit('bean_balance_update', balanceUpdatePayload);
            io.to(channelName).emit('diamond_balance_update', balanceUpdatePayload);
        }
        res.status(200).json({
            success: true,
            gift: {
                id: gift.id,
                name: gift.name,
                emoji: gift.emoji,
                giftType: gift.giftType ?? 'emoji',
                svgaUrl: gift.svgaUrl ?? null,
                animation: gift.animation ?? 'float',
                count: safeCount,
                totalCost,
                totalBeansEarned,
            },
            recipientId,
            recipientUsername,
            hostId: room.hostId,
            senderUsername: req.user.username,
            senderBeans: senderUpdated?.beanWallet ?? 0,
            senderDiamonds: senderUpdated?.diamonds ?? 0,
        });
    }
    catch (error) {
        console.error('[sendGiftToHost]', error);
        const knownClientErrors = ['Insufficient beans.', 'Sender not found.', 'Live room not found.'];
        const statusCode = knownClientErrors.includes(error.message) ? 400 : (error.status || 500);
        res.status(statusCode).json({ success: false, message: error.message || 'Failed to send gift.' });
    }
};
exports.sendGiftToHost = sendGiftToHost;
