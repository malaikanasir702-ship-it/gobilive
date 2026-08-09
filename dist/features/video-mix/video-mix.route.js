"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../core/middlewares/auth.middleware");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const video_mix_controller_1 = require("./video-mix.controller");
// Multer: store video in /tmp with original extension
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, '/tmp'),
    filename: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname) || '.mp4';
        cb(null, `upload_${Date.now()}${ext}`);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 200 * 1024 * 1024 }, // 200MB max
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('video/')) {
            cb(null, true);
        }
        else {
            cb(new Error('Only video files allowed'));
        }
    },
});
const router = (0, express_1.Router)();
/**
 * POST /api/video-mix/mix
 * Mixes background audio into a recorded video using FFmpeg.
 * Accepts either a video file upload OR a videoUrl in body.
 */
router.post('/mix', auth_middleware_1.authenticateJWT, upload.single('video'), video_mix_controller_1.mixVideoAudio);
exports.default = router;
