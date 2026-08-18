"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyFrames = exports.activateFrame = exports.purchaseFrame = exports.deleteFrame = exports.updateFrame = exports.uploadFrame = exports.getAllFramesAdmin = exports.getFrameCatalog = exports.frameUploadMiddleware = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const cloudinary_1 = require("cloudinary");
const frame_model_1 = require("./frame.model");
const user_model_1 = require("../auth/user.model");
const activity_log_service_1 = require("../activity-log/activity-log.service");
// ─── Multer — temp disk storage for PNG frame uploads ────────────────────────
const _storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, '/tmp'),
    filename: (_req, file, cb) => cb(null, `frame-${Date.now()}${path_1.default.extname(file.originalname)}`),
});
exports.frameUploadMiddleware = (0, multer_1.default)({
    storage: _storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
    fileFilter: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        const mime = file.mimetype;
        if (ext === '.png' && mime === 'image/png') {
            cb(null, true);
        }
        else {
            cb(new Error('Only PNG files are accepted for avatar frames.'));
        }
    },
}).single('file');
// ─── GET /api/frames  — public catalog (active only) ────────────────────────
const getFrameCatalog = async (_req, res) => {
    try {
        const frames = await frame_model_1.Frame.find({ isActive: true })
            .sort({ sortOrder: 1, createdAt: 1 })
            .lean();
        res.status(200).json({ success: true, frames });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getFrameCatalog = getFrameCatalog;
// ─── GET /api/frames/admin/all  — admin: all frames incl. inactive ───────────
const getAllFramesAdmin = async (_req, res) => {
    try {
        const frames = await frame_model_1.Frame.find().sort({ sortOrder: 1, createdAt: -1 }).lean();
        res.status(200).json({ success: true, frames });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getAllFramesAdmin = getAllFramesAdmin;
// ─── POST /api/frames/admin/upload  — company_admin uploads frame PNG ────────
const uploadFrame = async (req, res) => {
    const file = req.file;
    try {
        if (!file) {
            res.status(400).json({ success: false, message: 'No file uploaded.' });
            return;
        }
        const { name, price, avatarScale, category, sortOrder } = req.body;
        // Validate required fields
        if (!name || !name.trim()) {
            fs_1.default.unlinkSync(file.path);
            res.status(400).json({ success: false, message: 'Frame name is required.' });
            return;
        }
        const parsedPrice = Number(price);
        if (isNaN(parsedPrice) || parsedPrice < 0) {
            fs_1.default.unlinkSync(file.path);
            res.status(400).json({ success: false, message: 'Price must be a non-negative number.' });
            return;
        }
        const parsedScale = Number(avatarScale ?? 0.60);
        if (isNaN(parsedScale) || parsedScale < 0.3 || parsedScale > 0.9) {
            fs_1.default.unlinkSync(file.path);
            res.status(400).json({ success: false, message: 'avatarScale must be between 0.3 and 0.9.' });
            return;
        }
        // Upload PNG to Cloudinary
        const result = await cloudinary_1.v2.uploader.upload(file.path, {
            folder: 'gobilive_frames',
            resource_type: 'image',
            public_id: `frame_${Date.now()}`,
            overwrite: false,
            format: 'png',
            transformation: [
                { quality: 'auto:best', fetch_format: 'png' },
            ],
        });
        try {
            fs_1.default.unlinkSync(file.path);
        }
        catch (_) { }
        const frame = await frame_model_1.Frame.create({
            name: name.trim(),
            imageUrl: result.secure_url,
            thumbnailUrl: result.secure_url,
            price: parsedPrice,
            avatarScale: parsedScale,
            category: (category ?? 'standard').trim(),
            isActive: true,
            sortOrder: Number(sortOrder ?? 0),
        });
        await (0, activity_log_service_1.logActivity)({
            actorId: req.adminUser.id,
            actorRole: req.adminUser.role,
            actionType: 'create_frame',
            targetEntityType: 'Frame',
            targetEntityId: frame._id.toString(),
            description: `Uploaded avatar frame "${frame.name}" (price: ${frame.price} beans)`,
        });
        res.status(201).json({ success: true, frame });
    }
    catch (err) {
        if (req.file?.path) {
            try {
                fs_1.default.unlinkSync(req.file.path);
            }
            catch (_) { }
        }
        console.error('[uploadFrame]', err);
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.uploadFrame = uploadFrame;
// ─── PATCH /api/frames/admin/:id  — update frame metadata ───────────────────
const updateFrame = async (req, res) => {
    try {
        const id = String(req.params.id);
        const allowed = ['name', 'price', 'avatarScale', 'category', 'isActive', 'sortOrder'];
        const updates = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined)
                updates[key] = req.body[key];
        }
        if (updates.avatarScale !== undefined) {
            const scale = Number(updates.avatarScale);
            if (isNaN(scale) || scale < 0.3 || scale > 0.9) {
                res.status(400).json({ success: false, message: 'avatarScale must be between 0.3 and 0.9.' });
                return;
            }
        }
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({ success: false, message: 'Invalid frame ID.' });
            return;
        }
        const frame = await frame_model_1.Frame.findByIdAndUpdate(id, updates, { new: true });
        if (!frame) {
            res.status(404).json({ success: false, message: 'Frame not found.' });
            return;
        }
        res.status(200).json({ success: true, frame });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.updateFrame = updateFrame;
// ─── DELETE /api/frames/admin/:id  — delete frame (admin only) ───────────────
const deleteFrame = async (req, res) => {
    try {
        const id = String(req.params.id);
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({ success: false, message: 'Invalid frame ID.' });
            return;
        }
        const frame = await frame_model_1.Frame.findByIdAndDelete(id);
        if (!frame) {
            res.status(404).json({ success: false, message: 'Frame not found.' });
            return;
        }
        res.status(200).json({ success: true, message: 'Frame deleted.' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.deleteFrame = deleteFrame;
// ─── POST /api/frames/purchase/:id  — user purchases a frame with Beans ──────
const purchaseFrame = async (req, res) => {
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const id = String(req.params.id);
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({ success: false, message: 'Invalid frame ID.' });
            return;
        }
        const frame = await frame_model_1.Frame.findById(id).lean();
        if (!frame || !frame.isActive) {
            res.status(404).json({ success: false, message: 'Frame not found or inactive.' });
            return;
        }
        // Check if user already owns this frame
        const user = await user_model_1.User.findById(req.user.id)
            .select('beanWallet purchasedFrames activeFrameId username')
            .session(session);
        if (!user) {
            await session.abortTransaction();
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        const purchasedFrames = user.purchasedFrames ?? [];
        const frameIdStr = frame._id.toString();
        if (purchasedFrames.includes(frameIdStr)) {
            await session.abortTransaction();
            res.status(400).json({ success: false, message: 'You already own this frame.' });
            return;
        }
        // Check balance
        if ((user.beanWallet ?? 0) < frame.price) {
            await session.abortTransaction();
            res.status(400).json({ success: false, message: 'Insufficient Beans balance.' });
            return;
        }
        // Deduct beans + add frame to user's collection
        const updatedUser = await user_model_1.User.findByIdAndUpdate(req.user.id, {
            $inc: { beanWallet: -frame.price },
            $addToSet: { purchasedFrames: frameIdStr },
        }, { new: true, session }).select('beanWallet purchasedFrames activeFrameId');
        // Increment frame purchase count
        await frame_model_1.Frame.findByIdAndUpdate(id, { $inc: { purchaseCount: 1 } }, { session });
        await session.commitTransaction();
        await (0, activity_log_service_1.logActivity)({
            actorId: req.user.id,
            actorRole: req.user.role ?? 'user',
            actionType: 'purchase_frame',
            targetEntityType: 'Frame',
            targetEntityId: frameIdStr,
            description: `User @${user.username} purchased frame "${frame.name}" for ${frame.price} beans`,
        });
        res.status(200).json({
            success: true,
            message: `Frame "${frame.name}" purchased successfully!`,
            frame: {
                id: frameIdStr,
                name: frame.name,
                imageUrl: frame.imageUrl,
                avatarScale: frame.avatarScale,
            },
            beanWallet: updatedUser?.beanWallet ?? 0,
            purchasedFrames: updatedUser?.purchasedFrames ?? [],
        });
    }
    catch (err) {
        await session.abortTransaction();
        console.error('[purchaseFrame]', err);
        res.status(500).json({ success: false, message: err.message });
    }
    finally {
        session.endSession();
    }
};
exports.purchaseFrame = purchaseFrame;
// ─── POST /api/frames/activate/:id  — user activates a purchased frame ───────
const activateFrame = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const id = String(req.params.id);
        // Allow deactivating (passing 'none' removes active frame)
        if (id === 'none') {
            await user_model_1.User.findByIdAndUpdate(req.user.id, { activeFrameId: null });
            res.status(200).json({ success: true, message: 'Frame removed.', activeFrameId: null });
            return;
        }
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({ success: false, message: 'Invalid frame ID.' });
            return;
        }
        const user = await user_model_1.User.findById(req.user.id).select('purchasedFrames').lean();
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        const purchasedFrames = user.purchasedFrames ?? [];
        if (!purchasedFrames.includes(id)) {
            res.status(403).json({ success: false, message: 'You do not own this frame.' });
            return;
        }
        // Verify frame still exists
        const frame = await frame_model_1.Frame.findById(id).lean();
        if (!frame) {
            res.status(404).json({ success: false, message: 'Frame not found.' });
            return;
        }
        await user_model_1.User.findByIdAndUpdate(req.user.id, { activeFrameId: id });
        res.status(200).json({
            success: true,
            message: `Frame "${frame.name}" is now active!`,
            activeFrameId: id,
            frame: {
                id,
                name: frame.name,
                imageUrl: frame.imageUrl,
                avatarScale: frame.avatarScale,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.activateFrame = activateFrame;
// ─── GET /api/frames/my  — user's purchased frames + active frame ────────────
const getMyFrames = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const user = await user_model_1.User.findById(req.user.id)
            .select('purchasedFrames activeFrameId beanWallet')
            .lean();
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        const purchasedFrames = user.purchasedFrames ?? [];
        const activeFrameId = user.activeFrameId ?? null;
        // Fetch full frame data for owned frames
        const ownedFrames = purchasedFrames.length > 0
            ? await frame_model_1.Frame.find({ _id: { $in: purchasedFrames } }).lean()
            : [];
        let activeFrame = null;
        if (activeFrameId) {
            activeFrame = ownedFrames.find((f) => f._id.toString() === activeFrameId) ?? null;
        }
        res.status(200).json({
            success: true,
            ownedFrames,
            activeFrameId,
            activeFrame,
            beanWallet: user.beanWallet ?? 0,
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getMyFrames = getMyFrames;
