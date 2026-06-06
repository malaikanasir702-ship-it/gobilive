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
 *   - Triggers an eager transformation using the 'sp_auto' Cloudinary streaming profile.
 *   - This pre-generates HLS segments (.m3u8 + .ts chunks) immediately so the Flutter
 *     app can switch from raw .mp4 delivery to adaptive bitrate (HLS) playback instantly.
 *   - eager_async: true means Cloudinary generates HLS in background — no extra wait time.
 *
 * Returns:
 *   { success, url, public_id, format, resource_type, mimetype, size }
 *
 * The Flutter app MUST use the 'url' field and convert it to HLS using getHlsUrl():
 *   url.replace('.mp4', '.m3u8').replace('/upload/', '/upload/sp_auto/')
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

      // CRITICAL: Pre-generate HLS (.m3u8 + .ts segments) using sp_auto adaptive profile.
      // This is what makes TikTok-like instant playback possible.
      // eager_async=true means it happens in the background — no delay on upload response.
      ...(isVideo && {
        eager: [{ streaming_profile: 'sp_auto', format: 'm3u8' }],
        eager_async: true,
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
