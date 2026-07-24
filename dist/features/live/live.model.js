"use strict";
/**
 * live.model.ts
 *
 * Extended LiveRoom Mongoose model that now supports:
 *  - Multi-broadcast seat layouts (2, 4, 9, 13, 16 seats)
 *  - Audio-only rooms
 *  - Per-seat host control flags (mute, camera, audio-only mode)
 *  - 7-tier VIP priority allocation
 *
 * BACKWARD COMPATIBILITY GUARANTEE:
 *  All new fields are optional with safe defaults, so every existing
 *  LiveRoom document in MongoDB continues to work without migration.
 *  The existing likes / saves / viewerCount / PK logic is completely
 *  untouched — new fields are additive only.
 */
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
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const SeatSchema = new mongoose_1.Schema({
    seatIndex: { type: Number, required: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: null },
    username: { type: String, default: '' },
    profilePic: { type: String, default: '' },
    agoraUid: { type: Number, default: 0 },
    isMutedByHost: { type: Boolean, default: false },
    isCamAllowedByHost: { type: Boolean, default: false },
    isAudioOnly: { type: Boolean, default: true },
    occupiedAt: { type: Date },
}, { _id: false } // subdocuments don't need their own _id
);
const VipEntrySchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    profilePic: { type: String, default: '' },
    tier: { type: Number, enum: [1, 2, 3, 4, 5, 6, 7], required: true },
    tierLabel: { type: String, default: '' },
}, { _id: false });
const SideCallerSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    profilePic: { type: String, default: '' },
    agoraUid: { type: Number, default: 0 },
    isAccepted: { type: Boolean, default: false },
    isAudioOnly: { type: Boolean, default: false },
    isMutedByHost: { type: Boolean, default: false },
    isCamAllowedByHost: { type: Boolean, default: false },
    requestedAt: { type: Date, default: Date.now },
}, { _id: false });
// ─────────────────────────────────────────────
// Schema definition
// ─────────────────────────────────────────────
const LiveRoomSchema = new mongoose_1.Schema({
    channelName: { type: String, required: true, unique: true },
    hostId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    hostUsername: { type: String, required: true },
    hostLevel: { type: Number, default: 1 },
    title: { type: String, default: 'Live Now!' },
    category: { type: String, default: '' },
    privacyMode: {
        type: String,
        enum: ['public', 'private', 'followers'],
        default: 'public',
    },
    isActive: { type: Boolean, default: true },
    viewerCount: { type: Number, default: 0 },
    // PK (untouched)
    isPKActive: { type: Boolean, default: false },
    opponentRoomId: { type: String },
    opponentHost: { type: String },
    blockedViewers: { type: [String], default: [] },
    // Interactions (untouched)
    likedBy: { type: [mongoose_1.Schema.Types.ObjectId], ref: 'User', default: [] },
    savedBy: { type: [mongoose_1.Schema.Types.ObjectId], ref: 'User', default: [] },
    totalGifts: { type: Number, default: 0 },
    totalDiamondsEarned: { type: Number, default: 0 },
    peakViewers: { type: Number, default: 0 },
    totalHearts: { type: Number, default: 0 },
    // Session summary (untouched)
    sessionSummary: {
        durationSeconds: Number,
        totalViewers: Number,
        giftsReceived: Number,
        diamondsEarned: Number,
        totalHearts: { type: Number, default: 0 },
        endedAt: Date,
    },
    // ── NEW fields (all optional with safe defaults) ──
    roomType: {
        type: String,
        enum: ['live', 'multi-broadcast', 'audio'],
        default: 'live',
    },
    seatLayoutCount: {
        type: Number,
        enum: [2, 4, 9, 13, 16],
        default: 9,
    },
    seats: { type: [SeatSchema], default: [] },
    vips: { type: [VipEntrySchema], default: [] },
    sideCallers: { type: [SideCallerSchema], default: [] },
    // Snapshot URL set by the host's Flutter app shortly after going live
    thumbnailUrl: { type: String, default: '' },
}, { timestamps: true });
// ─────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────
LiveRoomSchema.index({ hostId: 1, isActive: 1 });
LiveRoomSchema.index({ isActive: 1, roomType: 1, privacyMode: 1 });
exports.default = mongoose_1.default.model('LiveRoom', LiveRoomSchema);
