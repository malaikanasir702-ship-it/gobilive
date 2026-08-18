import mongoose, { Document, Schema } from 'mongoose';

/**
 * Avatar Frame stored in MongoDB.
 * Company admin uploads PNG frames via the admin panel.
 * Users purchase frames with Beans and activate one at a time.
 *
 * avatarScale — the transparent hole diameter as a fraction of the frame's width.
 *   e.g. 0.60 means the avatar fills 60% of the total frame image width.
 *   Designer must keep the hole centered and maintain this convention.
 */
export interface IFrame extends Document {
  name: string;
  imageUrl: string;        // Cloudinary secure_url (transparent PNG)
  thumbnailUrl?: string;   // Optional smaller preview URL
  price: number;           // Cost in Beans
  avatarScale: number;     // Hole size ratio: 0.0–1.0 (default 0.60)
  category: string;        // e.g. "premium", "seasonal", "free"
  isActive: boolean;
  sortOrder: number;
  purchaseCount: number;   // How many users bought this frame
  createdAt: Date;
  updatedAt: Date;
}

const FrameSchema = new Schema<IFrame>(
  {
    name:          { type: String, required: true, trim: true },
    imageUrl:      { type: String, required: true },
    thumbnailUrl:  { type: String, default: null },
    price:         { type: Number, required: true, min: 0 },
    avatarScale:   { type: Number, default: 0.60, min: 0.3, max: 0.9 },
    category:      { type: String, default: 'standard', trim: true },
    isActive:      { type: Boolean, default: true },
    sortOrder:     { type: Number, default: 0 },
    purchaseCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

FrameSchema.index({ isActive: 1, sortOrder: 1 });

export const Frame = mongoose.model<IFrame>('Frame', FrameSchema);
