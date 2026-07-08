import mongoose, { Document, Schema } from 'mongoose';

export interface ISound extends Document {
  title: string;
  artist: string;
  url: string;           // audio file URL (Cloudinary or S3)
  coverUrl: string;      // album art URL
  duration: number;      // seconds
  genre: string;         // 'pop' | 'hip-hop' | 'rnb' | 'electronic' | 'trending' | 'other'
  usageCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SoundSchema = new Schema<ISound>(
  {
    title: { type: String, required: true, trim: true },
    artist: { type: String, required: true, trim: true },
    url: { type: String, required: true },
    coverUrl: { type: String, default: '' },
    duration: { type: Number, default: 0 },
    genre: {
      type: String,
      enum: ['pop', 'hip-hop', 'rnb', 'electronic', 'trending', 'other'],
      default: 'other',
    },
    usageCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

SoundSchema.index({ genre: 1 });
SoundSchema.index({ usageCount: -1 });
SoundSchema.index({ title: 'text', artist: 'text' });

export const Sound = mongoose.model<ISound>('Sound', SoundSchema);
