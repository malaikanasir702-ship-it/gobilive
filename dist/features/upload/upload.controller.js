"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminUploadFile = exports.uploadFile = void 0;
const cloudinary_1 = require("cloudinary");
const fs_1 = __importDefault(require("fs"));
/**
 * POST /api/upload/media
 *
 * Uploads a file (video or image) to Cloudinary under the "gobilive_shorts" folder.
 *
 * For VIDEOS:
 *   - quality: 'auto:best' — preserves maximum visual quality, no noticeable compression loss.
 *   - video_codec: 'auto' — Cloudinary picks the optimal codec (h264/h265) without downgrading resolution.
 *   - Triggers eager HLS generation using the 'hd' streaming profile (higher quality than sp_auto).
 *   - eager_async: true means HLS generation happens in the background — no extra wait time on upload.
 *
 * For IMAGES:
 *   - quality: 'auto:best' — preserves original image quality.
 *
 * Returns:
 *   { success, url, public_id, format, resource_type, mimetype, size }
 *
 * The Flutter app MUST use the 'url' field and convert it to HLS using getHlsUrl():
 *   url.replace('.mp4', '.m3u8').replace('/upload/', '/upload/hd/')
 */
const uploadFile = async (req, res) => {
    const file = req.file;
    try {
        // Auth check
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        // File presence check
        if (!file) {
            res.status(400).json({ success: false, message: 'No file uploaded.' });
            return;
        }
        const isVideo = file.mimetype.startsWith('video/');
        // Upload to Cloudinary
        const result = await cloudinary_1.v2.uploader.upload(file.path, {
            folder: 'gobilive_shorts',
            resource_type: isVideo ? 'video' : 'image',
            // VIDEO: Upload original quality without any quality reduction.
            // - quality: 'auto:best' — Cloudinary picks the best quality encoding (no visible loss)
            // - video_codec: 'auto' — lets Cloudinary pick the best codec (h264/h265) without downgrading
            // - Pre-generate HLS (.m3u8 + .ts segments) using sp_hd profile for HD adaptive streaming.
            // - eager_async=true means HLS generation happens in background — no upload delay.
            ...(isVideo && {
                quality: 'auto:best',
                video_codec: 'auto',
                eager: [
                    // HD streaming profile — preserves quality better than sp_auto
                    { streaming_profile: 'hd', format: 'm3u8' },
                ],
                eager_async: true,
            }),
            // IMAGE: Use lossless-best quality to avoid any compression artifacts
            ...(!isVideo && {
                quality: 'auto:best',
            }),
        });
        // Clean up the local temp file saved by Multer — no longer needed
        if (fs_1.default.existsSync(file.path)) {
            fs_1.default.unlinkSync(file.path);
        }
        // Return Cloudinary's secure_url + public_id to the Flutter app
        res.status(201).json({
            success: true,
            url: result.secure_url, // e.g. https://res.cloudinary.com/.../gobilive_shorts/abc.mp4
            public_id: result.public_id, // e.g. gobilive_shorts/abc
            format: result.format,
            resource_type: result.resource_type,
            mimetype: file.mimetype,
            size: file.size,
        });
    }
    catch (error) {
        // Clean up temp file even on Cloudinary failure
        if (file && fs_1.default.existsSync(file.path)) {
            try {
                fs_1.default.unlinkSync(file.path);
            }
            catch (_) { }
        }
        console.error('[Upload] Cloudinary error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.uploadFile = uploadFile;
/**
 * POST /api/upload/admin-file
 * Admin panel file upload — authenticated via admin JWT.
 * Used for transfer slips, screenshots, etc.
 */
const adminUploadFile = async (req, res) => {
    const file = req.file;
    try {
        if (!file) {
            res.status(400).json({ success: false, message: 'No file uploaded.' });
            return;
        }
        let url;
        let publicId;
        try {
            const isImage = file.mimetype.startsWith('image/');
            const isPdf = file.mimetype === 'application/pdf';
            const result = await cloudinary_1.v2.uploader.upload(file.path, {
                folder: 'gobilive_admin_slips',
                resource_type: isPdf ? 'raw' : 'image',
                ...(isImage && { quality: 'auto:best' }),
            });
            url = result.secure_url;
            publicId = result.public_id;
            if (fs_1.default.existsSync(file.path)) {
                fs_1.default.unlinkSync(file.path);
            }
        }
        catch (cloudErr) {
            console.warn('[AdminUpload] Cloudinary upload failed, falling back to local file URL:', cloudErr.message);
            // Fallback: use local /uploads/ static path served by app.ts
            url = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
            publicId = file.filename;
        }
        res.status(201).json({
            success: true,
            url,
            public_id: publicId,
        });
    }
    catch (error) {
        if (file && fs_1.default.existsSync(file.path)) {
            try {
                fs_1.default.unlinkSync(file.path);
            }
            catch (_) { }
        }
        console.error('[AdminUpload] error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.adminUploadFile = adminUploadFile;
