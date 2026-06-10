import mongoose, { Document, Schema } from 'mongoose';

/**
 * Gift Item stored in MongoDB.
 * Emoji gifts work without a svgaUrl (legacy / lightweight).
 * Animated SVGA gifts carry a Cloudinary-hosted URL in svgaUrl.
 */
export interface IGift extends Document {
  id: string;          // human-readable slug, e.g. "rose"
  name: string;
  emoji: string;       // fallback emoji (always present)
  diamondCost: number;
  rcoinEarned: number;
  isVipOnly: boolean;
  animation: string;   // animation style hint ("float", "pulse", "epic" …)
  giftType: 'emoji' | 'svga' | 'animated'; // 'animated' = built-in Flutter CustomPainter animation
  svgaUrl?: string;    // Cloudinary secure_url — only for giftType === 'svga'
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const GiftSchema = new Schema<IGift>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    emoji: { type: String, required: true, default: '🎁' },
    diamondCost: { type: Number, required: true, min: 1 },
    rcoinEarned: { type: Number, required: true, min: 0 },
    isVipOnly: { type: Boolean, default: false },
    animation: { type: String, default: 'float' },
    giftType: { type: String, enum: ['emoji', 'svga', 'animated'], default: 'emoji' },
    svgaUrl: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Index for fast catalog queries
GiftSchema.index({ isActive: 1, sortOrder: 1 });
GiftSchema.index({ giftType: 1 });

export const Gift = mongoose.model<IGift>('Gift', GiftSchema);
