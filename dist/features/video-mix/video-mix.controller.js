"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mixVideoAudio = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const cloudinary_1 = require("cloudinary");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const https_1 = __importDefault(require("https"));
const http_1 = __importDefault(require("http"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
// ── Helpers ──────────────────────────────────────────────────────────────────
/** Download a file from a URL to a local temp path */
function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const proto = url.startsWith('https') ? https_1.default : http_1.default;
        const file = fs_1.default.createWriteStream(destPath);
        proto.get(url, (response) => {
            if (response.statusCode !== 200) {
                file.close();
                fs_1.default.unlink(destPath, () => { });
                return reject(new Error(`Download failed: HTTP ${response.statusCode} for ${url}`));
            }
            response.pipe(file);
            file.on('finish', () => file.close(resolve));
        }).on('error', (err) => {
            file.close();
            fs_1.default.unlink(destPath, () => { });
            reject(err);
        });
    });
}
/** Check if ffmpeg binary is available on this server */
async function isFfmpegAvailable() {
    try {
        await execAsync('ffmpeg -version');
        return true;
    }
    catch {
        return false;
    }
}
// ── Controller ───────────────────────────────────────────────────────────────
/**
 * POST /api/video-mix/mix
 *
 * Body (multipart/form-data):
 *   - video: video file (required) OR videoUrl: string
 *   - audioUrl: string (iTunes/CDN audio preview URL, required)
 *   - micVolume: number (0.0–1.0, default 0.3) — mic track volume
 *   - bgVolume: number (0.0–1.0, default 1.0) — background music volume
 *
 * Response:
 *   { success, mixedVideoUrl, public_id }
 *
 * Process:
 *   1. Accept uploaded video file (from app) OR download from videoUrl
 *   2. Download audio from audioUrl (iTunes CDN)
 *   3. Run FFmpeg: mix mic audio + background music → new MP4
 *   4. Upload mixed MP4 to Cloudinary
 *   5. Clean up temp files
 *   6. Return Cloudinary URL
 */
const mixVideoAudio = async (req, res) => {
    const tmpFiles = [];
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const audioUrl = req.body.audioUrl;
        const micVolume = parseFloat(req.body.micVolume ?? '0.3');
        const bgVolume = parseFloat(req.body.bgVolume ?? '1.0');
        if (!audioUrl) {
            res.status(400).json({ success: false, message: 'audioUrl is required.' });
            return;
        }
        // Check FFmpeg availability
        const ffmpegOk = await isFfmpegAvailable();
        if (!ffmpegOk) {
            res.status(503).json({
                success: false,
                message: 'FFmpeg not available on this server. Audio mixing not supported.',
            });
            return;
        }
        const tmpDir = '/tmp';
        const ts = Date.now();
        // ── Step 1: Get video file ─────────────────────────────────────────────
        let videoPath;
        const uploadedFile = req.file;
        if (uploadedFile) {
            videoPath = uploadedFile.path;
            tmpFiles.push(videoPath);
        }
        else {
            const videoUrl = req.body.videoUrl;
            if (!videoUrl) {
                res.status(400).json({ success: false, message: 'Provide either a video file or videoUrl.' });
                return;
            }
            videoPath = path_1.default.join(tmpDir, `mix_video_${ts}.mp4`);
            tmpFiles.push(videoPath);
            await downloadFile(videoUrl, videoPath);
        }
        // ── Step 2: Download audio ─────────────────────────────────────────────
        const audioExt = audioUrl.includes('.m4a') ? 'm4a' : 'mp3';
        const audioPath = path_1.default.join(tmpDir, `mix_audio_${ts}.${audioExt}`);
        tmpFiles.push(audioPath);
        await downloadFile(audioUrl, audioPath);
        // ── Step 3: FFmpeg mixing ──────────────────────────────────────────────
        const outputPath = path_1.default.join(tmpDir, `mixed_${ts}.mp4`);
        tmpFiles.push(outputPath);
        // FFmpeg command:
        // [0:a] = mic audio from phone (volume lowered to 30%)
        // [1:a] = background music (volume at 100%)
        // amix: blend both tracks, cut when video ends
        // -c:v copy: keep original video — no re-encode (fast + lossless quality)
        // -c:a aac -b:a 192k: encode mixed audio as AAC 192kbps
        // -shortest: stop at shortest input (video length)
        const ffmpegCmd = [
            'ffmpeg',
            `-i "${videoPath}"`,
            `-i "${audioPath}"`,
            `-filter_complex "[0:a]volume=${micVolume}[mic];[1:a]volume=${bgVolume}[bg];[mic][bg]amix=inputs=2:duration=shortest[aout]"`,
            '-map 0:v',
            '-map "[aout]"',
            '-c:v copy',
            '-c:a aac -b:a 192k',
            '-shortest',
            '-y',
            `"${outputPath}"`,
        ].join(' ');
        console.log('[VideoMix] Running FFmpeg mix...');
        const { stderr } = await execAsync(ffmpegCmd, { timeout: 120_000 });
        if (stderr && process.env.NODE_ENV !== 'production') {
            console.log('[VideoMix] FFmpeg stderr:', stderr.slice(-500));
        }
        if (!fs_1.default.existsSync(outputPath)) {
            throw new Error('FFmpeg produced no output file.');
        }
        const outputSizeKb = Math.round(fs_1.default.statSync(outputPath).size / 1024);
        console.log(`[VideoMix] ✅ Mixed video: ${outputSizeKb}KB`);
        // ── Step 4: Upload to Cloudinary ───────────────────────────────────────
        const cloudResult = await cloudinary_1.v2.uploader.upload(outputPath, {
            folder: 'gobilive_mixed_shorts',
            resource_type: 'video',
            quality: 'auto:best',
            video_codec: 'auto',
            eager: [{ streaming_profile: 'hd', format: 'm3u8' }],
            eager_async: true,
        });
        console.log(`[VideoMix] ✅ Uploaded to Cloudinary: ${cloudResult.secure_url}`);
        res.status(200).json({
            success: true,
            mixedVideoUrl: cloudResult.secure_url,
            public_id: cloudResult.public_id,
        });
    }
    catch (err) {
        console.error('[VideoMix] Error:', err.message);
        res.status(500).json({ success: false, message: err.message || 'Mixing failed.' });
    }
    finally {
        // ── Step 5: Cleanup temp files ─────────────────────────────────────────
        for (const f of tmpFiles) {
            try {
                if (fs_1.default.existsSync(f))
                    fs_1.default.unlinkSync(f);
            }
            catch (_) { }
        }
    }
};
exports.mixVideoAudio = mixVideoAudio;
