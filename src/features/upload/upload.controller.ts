import { Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import { AuthRequest } from '../../core/middlewares/auth.middleware';

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
export const uploadFile = async (req: AuthRequest, res: Response): Promise<void> => {
  const file = (req as AuthRequest & { file?: Express.Multer.File }).file;

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
    const result = await cloudinary.uploader.upload(file.path, {
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
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    // Return Cloudinary's secure_url + public_id to the Flutter app
    res.status(201).json({
      success: true,
      url: result.secure_url,         // e.g. https://res.cloudinary.com/.../gobilive_shorts/abc.mp4
      public_id: result.public_id,    // e.g. gobilive_shorts/abc
      format: result.format,
      resource_type: result.resource_type,
      mimetype: file.mimetype,
      size: file.size,
    });
  } catch (error: any) {
    // Clean up temp file even on Cloudinary failure
    if (file && fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch (_) {}
    }
    console.error('[Upload] Cloudinary error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
