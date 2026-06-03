import mongoose, { Schema, Document } from 'mongoose';

export type LivePrivacyMode = 'public' | 'private' | 'followers';

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
  isPKActive: boolean;
  opponentRoomId?: string;
  opponentHost?: string;
  blockedViewers: string[];
  likedBy: mongoose.Types.ObjectId[];
  savedBy: mongoose.Types.ObjectId[];
  totalGifts: number;
  totalDiamondsEarned: number;
  peakViewers: number;
  sessionSummary?: {
    durationSeconds: number;
    totalViewers: number;
    giftsReceived: number;
    diamondsEarned: number;
    endedAt: Date;
  };
  createdAt: Date;
}

const LiveRoomSchema = new Schema<ILiveRoom>(
  {
    channelName: { type: String, required: true, unique: true },
    hostId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    hostUsername: { type: String, required: true },
    hostLevel: { type: Number, default: 1 },
    title: { type: String, default: 'Live Now!' },
    category: { type: String, default: '' },
    privacyMode: { type: String, enum: ['public', 'private', 'followers'], default: 'public' },
    isActive: { type: Boolean, default: true },
    viewerCount: { type: Number, default: 0 },
    isPKActive: { type: Boolean, default: false },
    opponentRoomId: { type: String },
    opponentHost: { type: String },
    blockedViewers: { type: [String], default: [] },
    likedBy: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
    savedBy: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
    totalGifts: { type: Number, default: 0 },
    totalDiamondsEarned: { type: Number, default: 0 },
    peakViewers: { type: Number, default: 0 },
    sessionSummary: {
      durationSeconds: Number,
      totalViewers: Number,
      giftsReceived: Number,
      diamondsEarned: Number,
      endedAt: Date,
    },
  },
  { timestamps: true }
);

export default mongoose.model<ILiveRoom>('LiveRoom', LiveRoomSchema);
