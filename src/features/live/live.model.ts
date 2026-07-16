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

import mongoose, { Schema, Document } from 'mongoose';

// ─────────────────────────────────────────────
// Room type taxonomy
// ─────────────────────────────────────────────
export type LivePrivacyMode = 'public' | 'private' | 'followers';

/** Determines UI layout and Agora channel behaviour. */
export type RoomType = 'live' | 'multi-broadcast' | 'audio';

/**
 * Number of seats shown in the multi-broadcast grid.
 *  2  → Side-by-side (Team PK)
 *  4  → 2×2 Team PK block
 *  9  → 3×3 uniform grid
 *  13 → 4-seat PK header + 12-seat uniform grid below
 *  16 → 4×4 uniform grid
 */
export type SeatLayoutCount = 2 | 4 | 9 | 13 | 16;

// ─────────────────────────────────────────────
// Seat document
// ─────────────────────────────────────────────
export interface ISeat {
  /** 0-based position index within the current layout */
  seatIndex: number;

  /**
   * MongoDB ObjectId of the occupant.
   * null / undefined means the seat is empty.
   */
  userId?: mongoose.Types.ObjectId | null;

  /** Display name cached for fast broadcast — re-synced on every join. */
  username?: string;

  /** Profile picture URL cached for avatar in the grid. */
  profilePic?: string;

  /** Agora numeric UID assigned to this seat occupant (0 if empty). */
  agoraUid: number;

  /** Host has remotely muted this occupant's microphone. */
  isMutedByHost: boolean;

  /** Host has explicitly granted camera-on permission to this seat. */
  isCamAllowedByHost: boolean;

  /**
   * True → occupant joins as Broadcaster but with local video muted.
   * The seat shows a profile avatar instead of a video stream.
   */
  isAudioOnly: boolean;

  /** Timestamp of when this seat was occupied (for session analytics). */
  occupiedAt?: Date;
}

const SeatSchema = new Schema<ISeat>(
  {
    seatIndex: { type: Number, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    username: { type: String, default: '' },
    profilePic: { type: String, default: '' },
    agoraUid: { type: Number, default: 0 },
    isMutedByHost: { type: Boolean, default: false },
    isCamAllowedByHost: { type: Boolean, default: false },
    isAudioOnly: { type: Boolean, default: true },
    occupiedAt: { type: Date },
  },
  { _id: false } // subdocuments don't need their own _id
);

// ─────────────────────────────────────────────
// VIP entry document
// ─────────────────────────────────────────────
/**
 * Seven VIP tiers (Tier 1 = highest priority seat allocation).
 * The Flutter UI renders a distinct animated border per tier.
 */
export type VipTier = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface IVipEntry {
  userId: mongoose.Types.ObjectId;
  username: string;
  profilePic?: string;
  tier: VipTier;
  /** ISO display label shown in the VIP badge (e.g. "Diamond I", "Gold III") */
  tierLabel: string;
}

const VipEntrySchema = new Schema<IVipEntry>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    profilePic: { type: String, default: '' },
    tier: { type: Number, enum: [1, 2, 3, 4, 5, 6, 7], required: true },
    tierLabel: { type: String, default: '' },
  },
  { _id: false }
);

// ─────────────────────────────────────────────
// Side caller document (single-host streams only)
// ─────────────────────────────────────────────
export interface ISideCaller {
  userId: mongoose.Types.ObjectId;
  username: string;
  profilePic?: string;
  agoraUid: number;
  /** Host has accepted the call request — occupant is now live. */
  isAccepted: boolean;
  isAudioOnly: boolean;
  isMutedByHost: boolean;
  isCamAllowedByHost: boolean;
  requestedAt: Date;
}

const SideCallerSchema = new Schema<ISideCaller>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    profilePic: { type: String, default: '' },
    agoraUid: { type: Number, default: 0 },
    isAccepted: { type: Boolean, default: false },
    isAudioOnly: { type: Boolean, default: false },
    isMutedByHost: { type: Boolean, default: false },
    isCamAllowedByHost: { type: Boolean, default: false },
    requestedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ─────────────────────────────────────────────
// Main LiveRoom interface
// ─────────────────────────────────────────────
export interface ILiveRoom extends Document {
  channelName: string;
  hostId: mongoose.Types.ObjectId;
  hostUsername: string;
  hostLevel: number;
  title: string;
  category?: string;
  privacyMode: LivePrivacyMode;
  isActive: boolean;
  viewerCount: number;

  // ── PK Battle (unchanged from original) ──
  isPKActive: boolean;
  opponentRoomId?: string;
  opponentHost?: string;
  blockedViewers: string[];

  // ── Interaction counters (unchanged from original) ──
  likedBy: mongoose.Types.ObjectId[];
  savedBy: mongoose.Types.ObjectId[];
  totalGifts: number;
  totalDiamondsEarned: number;
  peakViewers: number;
  totalHearts: number;

  // ── Session summary (unchanged from original) ──
  sessionSummary?: {
    durationSeconds: number;
    totalViewers: number;
    giftsReceived: number;
    diamondsEarned: number;
    totalHearts?: number;
    endedAt: Date;
  };

  // ── NEW: Multi-broadcast / audio room fields ──
  roomType: RoomType;
  seatLayoutCount: SeatLayoutCount;
  seats: ISeat[];
  vips: IVipEntry[];
  sideCallers: ISideCaller[];

  /** Cloudinary URL of the host's stream snapshot — shown in discovery cards. */
  thumbnailUrl?: string;

  createdAt: Date;
}

// ─────────────────────────────────────────────
// Schema definition
// ─────────────────────────────────────────────
const LiveRoomSchema = new Schema<ILiveRoom>(
  {
    channelName: { type: String, required: true, unique: true },
    hostId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
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
    likedBy: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
    savedBy: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
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
  },
  { timestamps: true }
);

// ─────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────
LiveRoomSchema.index({ hostId: 1, isActive: 1 });
LiveRoomSchema.index({ isActive: 1, roomType: 1, privacyMode: 1 });

export default mongoose.model<ILiveRoom>('LiveRoom', LiveRoomSchema);
