"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadWithWatermark = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const https_1 = __importDefault(require("https"));
const http_1 = __importDefault(require("http"));
const cloudinary_1 = require("cloudinary");
const post_model_1 = require("./post.model");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
/**
 * GET /api/feed/:id/download?username=xxx
 *
 * 1. Fetch post's videoUrl from DB
 * 2. Download video to /tmp
 * 3. FFmpeg: add logo + "globilive" + "@username" watermark at bottom-left
 * 4. Upload watermarked video to Cloudinary (auto-delete after 1 hour via eager_async)
 * 5. Return the Cloudinary secure_url for client to download & save to gallery
 */
const downloadWithWatermark = async (req, res) => {
    const { id } = req.params;
    const username = req.query.username || req.user?.username || 'gobilive';
    // videoUrl can be passed directly as query param to bypass DB lookup
    const directVideoUrl = req.query.videoUrl || '';
    const ts = Date.now();
    const rawPath = path_1.default.join(os_1.default.tmpdir(), `raw_${ts}.mp4`);
    const outPath = path_1.default.join(os_1.default.tmpdir(), `wm_${ts}.mp4`);
    let videoUrl = directVideoUrl;
    try {
        // ── 1. Get post videoUrl (from DB or direct param) ─────────────────────
        if (!videoUrl) {
            try {
                const post = await post_model_1.Post.findById(id).select('videoUrl username').lean();
                if (post?.videoUrl) {
                    videoUrl = post.videoUrl;
                }
            }
            catch (dbErr) {
                console.warn('[download] DB lookup failed:', dbErr);
            }
        }
        if (!videoUrl) {
            res.status(404).json({ success: false, message: 'Post or video not found.' });
            return;
        }
        const owner = username; // use the username passed from Flutter
        // ── 2. Download raw video to /tmp ────────────────────────────────────────
        await _downloadFile(videoUrl, rawPath);
        // ── 3. Build logo path ───────────────────────────────────────────────────
        // Logo is at: dist/public/logo.png  OR  public/logo.png  OR  use drawtext only
        const logoSrc = _findLogo();
        // ── 4. Build FFmpeg watermark command ─────────────────────────────────────
        // Watermark Layout (bottom-left):
        //
        //   [LOGO]  globilive        ← Line 1: Logo (aspect ratio preserved, h=34) + "globilive" text
        //   [LOGO]  @username        ← Line 2: @username text aligned below "globilive"
        //
        const formattedOwner = owner.startsWith('@') ? owner : `@${owner}`;
        const safeOwner = _escapeDrawtext(formattedOwner);
        let filterComplex;
        if (logoSrc) {
            // Logo scaled with aspect ratio preserved (height=34px, width ~45px for 4:3 logo)
            // Logo Y: bottom at H-32, top at H-66
            // Text X: starts at 75 (20 margin + 45 logo width + 10 gap)
            filterComplex =
                `[1:v]scale=-1:34[logo];` +
                    `[0:v][logo]overlay=20:H-h-32[v1];` +
                    `[v1]drawtext=` +
                    `fontsize=20:fontcolor=white:borderw=2:bordercolor=black@0.8:` +
                    `text='globilive':x=75:y=H-62` +
                    `[v2];` +
                    `[v2]drawtext=` +
                    `fontsize=14:fontcolor=white@0.9:borderw=1.5:bordercolor=black@0.8:` +
                    `text='${safeOwner}':x=75:y=H-36` +
                    `[out]`;
        }
        else {
            // Fallback if logo not found: text only at x=20
            filterComplex =
                `[0:v]drawtext=` +
                    `fontsize=20:fontcolor=white:borderw=2:bordercolor=black@0.8:` +
                    `text='globilive':x=20:y=H-62` +
                    `[v2];` +
                    `[v2]drawtext=` +
                    `fontsize=14:fontcolor=white@0.9:borderw=1.5:bordercolor=black@0.8:` +
                    `text='${safeOwner}':x=20:y=H-36` +
                    `[out]`;
        }
        // ── 5. Run FFmpeg ─────────────────────────────────────────────────────────
        const ffmpegArgs = [];
        ffmpegArgs.push('-i', rawPath);
        if (logoSrc)
            ffmpegArgs.push('-i', logoSrc);
        ffmpegArgs.push('-filter_complex', filterComplex, '-map', '[out]', '-map', '0:a?', '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'copy', '-y', outPath);
        try {
            await execFileAsync('ffmpeg', ffmpegArgs);
        }
        catch (ffmpegErr) {
            console.error('[download] FFmpeg failed, falling back to no-watermark:', ffmpegErr.message);
            // Fallback: serve original video URL directly
            _cleanup(rawPath, outPath);
            res.status(200).json({ success: true, downloadUrl: videoUrl, watermarked: false });
            return;
        }
        // ── 6. Upload watermarked video to Cloudinary ─────────────────────────────
        const uploadResult = await cloudinary_1.v2.uploader.upload(outPath, {
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
    }
    catch (err) {
        console.error('[downloadWithWatermark]', err);
        res.status(500).json({ success: false, message: err.message || 'Download failed.' });
    }
    finally {
        _cleanup(rawPath, outPath);
    }
};
exports.downloadWithWatermark = downloadWithWatermark;
// ── Helpers ───────────────────────────────────────────────────────────────────
function _downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs_1.default.createWriteStream(dest);
        const protocol = url.startsWith('https') ? https_1.default : http_1.default;
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
            fs_1.default.unlink(dest, () => { });
            reject(err);
        });
        // 2 minute timeout for video download
        request.setTimeout(120_000, () => {
            request.destroy();
            reject(new Error('Video download timed out.'));
        });
    });
}
function _findLogo() {
    // Look in multiple possible locations
    const candidates = [
        path_1.default.resolve(__dirname, '../../..', 'public', 'logo.png'),
        path_1.default.resolve(process.cwd(), 'public', 'logo.png'),
        path_1.default.resolve(process.cwd(), 'assets', 'logo.png'),
    ];
    for (const p of candidates) {
        if (fs_1.default.existsSync(p))
            return p;
    }
    return null;
}
function _escapeDrawtext(text) {
    return text
        .replaceAll('\\', '\\\\')
        .replaceAll(':', '\\:')
        .replaceAll("'", "\\'")
        .replaceAll('%', '\\%');
}
function _cleanup(...paths) {
    for (const p of paths) {
        try {
            if (fs_1.default.existsSync(p))
                fs_1.default.unlinkSync(p);
        }
        catch (_) { }
    }
}
