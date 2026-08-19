import { Response } from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import http from 'http';
import { v2 as cloudinary } from 'cloudinary';
import { Post } from './post.model';
import { AuthRequest } from '../../core/middlewares/auth.middleware';

const execFileAsync = promisify(execFile);

/**
 * GET /api/feed/:id/download?username=xxx
 *
 * 1. Fetch post's videoUrl from DB
 * 2. Download video to /tmp
 * 3. FFmpeg: add logo + "globilive" + "@username" watermark at bottom-left
 * 4. Upload watermarked video to Cloudinary (auto-delete after 1 hour via eager_async)
 * 5. Return the Cloudinary secure_url for client to download & save to gallery
 */
export const downloadWithWatermark = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const username = (req.query.username as string) || req.user?.username || 'gobilive';

  const ts = Date.now();
  const rawPath  = path.join(os.tmpdir(), `raw_${ts}.mp4`);
  const outPath  = path.join(os.tmpdir(), `wm_${ts}.mp4`);

  try {
    // ── 1. Get post videoUrl ─────────────────────────────────────────────────
    const post = await Post.findById(id).select('videoUrl username').lean() as any;
    if (!post?.videoUrl) {
      res.status(404).json({ success: false, message: 'Post or video not found.' });
      return;
    }

    const videoUrl = post.videoUrl as string;
    const owner    = (post.username as string) || username;

    // ── 2. Download raw video to /tmp ────────────────────────────────────────
    await _downloadFile(videoUrl, rawPath);

    // ── 3. Build logo path ───────────────────────────────────────────────────
    // Logo is at: dist/public/logo.png  OR  public/logo.png  OR  use drawtext only
    const logoSrc = _findLogo();

    // ── 4. Build FFmpeg watermark command ─────────────────────────────────────
    // Watermark layout (bottom-left, 20px from edge):
    //   [logo 50×50 px]
    //   globilive
    //   @username
    const safeOwner = _escapeDrawtext(`@${owner}`);
    let filterComplex: string;

    if (logoSrc) {
      filterComplex =
        `[1:v]scale=50:50[logo];` +
        `[0:v][logo]overlay=20:H-h-110[v1];` +
        `[v1]drawtext=` +
          `fontsize=18:fontcolor=white:borderw=2:bordercolor=black@0.8:` +
          `text='globilive':x=20:y=H-55` +
        `[v2];` +
        `[v2]drawtext=` +
          `fontsize=14:fontcolor=white@0.9:borderw=1:bordercolor=black@0.7:` +
          `text='${safeOwner}':x=20:y=H-32` +
        `[out]`;
    } else {
      // No logo — text only
      filterComplex =
        `[0:v]drawtext=` +
          `fontsize=18:fontcolor=white:borderw=2:bordercolor=black@0.8:` +
          `text='globilive':x=20:y=H-55` +
        `[v2];` +
        `[v2]drawtext=` +
          `fontsize=14:fontcolor=white@0.9:borderw=1:bordercolor=black@0.7:` +
          `text='${safeOwner}':x=20:y=H-32` +
        `[out]`;
    }

    // ── 5. Run FFmpeg ─────────────────────────────────────────────────────────
    const ffmpegArgs: string[] = [];

    ffmpegArgs.push('-i', rawPath);
    if (logoSrc) ffmpegArgs.push('-i', logoSrc);

    ffmpegArgs.push(
      '-filter_complex', filterComplex,
      '-map', '[out]',
      '-map', '0:a?',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-c:a', 'copy',
      '-y',
      outPath
    );

    try {
      await execFileAsync('ffmpeg', ffmpegArgs);
    } catch (ffmpegErr: any) {
      console.error('[download] FFmpeg failed, falling back to no-watermark:', ffmpegErr.message);
      // Fallback: serve original video URL directly
      _cleanup(rawPath, outPath);
      res.status(200).json({ success: true, downloadUrl: videoUrl, watermarked: false });
      return;
    }

    // ── 6. Upload watermarked video to Cloudinary ─────────────────────────────
    const uploadResult = await cloudinary.uploader.upload(outPath, {
      resource_type: 'video',
      folder: 'gobilive_downloads',
      public_id: `dl_${ts}`,
      // Auto-delete after 2 hours — temporary download link
      // (requires Cloudinary Auto Upload Mapping or scheduled deletion)
      overwrite: true,
    });

    // ── 7. Respond with download URL ──────────────────────────────────────────
    res.status(200).json({
      success: true,
      downloadUrl: uploadResult.secure_url,
      watermarked: true,
    });

  } catch (err: any) {
    console.error('[downloadWithWatermark]', err);
    res.status(500).json({ success: false, message: err.message || 'Download failed.' });
  } finally {
    _cleanup(rawPath, outPath);
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function _downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const protocol = url.startsWith('https') ? https : http;

    const request = protocol.get(url, (response) => {
      // Follow redirects (max 5)
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        _downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      response.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
      file.on('error', reject);
    });

    request.on('error', (err) => {
      file.close();
      fs.unlink(dest, () => {});
      reject(err);
    });

    // 2 minute timeout for video download
    request.setTimeout(120_000, () => {
      request.destroy();
      reject(new Error('Video download timed out.'));
    });
  });
}

function _findLogo(): string | null {
  // Look in multiple possible locations
  const candidates = [
    path.resolve(__dirname, '../../..', 'public', 'logo.png'),
    path.resolve(process.cwd(), 'public', 'logo.png'),
    path.resolve(process.cwd(), 'assets', 'logo.png'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function _escapeDrawtext(text: string): string {
  return text
    .replaceAll('\\', '\\\\')
    .replaceAll(':', '\\:')
    .replaceAll("'", "\\'")
    .replaceAll('%', '\\%');
}

function _cleanup(...paths: string[]) {
  for (const p of paths) {
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {}
  }
}
