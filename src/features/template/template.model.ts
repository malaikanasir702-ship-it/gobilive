import mongoose, { Document, Schema } from 'mongoose';

export interface ITemplate extends Document {
  title: string;
  videoUrl: string;
  thumbnailUrl: string;
  creator: string;
  usageCount: number;
  clipCount: number;
  category: string;
  soundId?: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TemplateSchema = new Schema<ITemplate>(
  {
    title: { type: String, required: true, trim: true },
    videoUrl: { type: String, required: true },
    thumbnailUrl: { type: String, default: '' },
    creator: { type: String, default: 'Gobilive' },
    usageCount: { type: Number, default: 0 },
    clipCount: { type: Number, default: 1 },
    category: {
      type: String,
      enum: ['for_you', 'viral_song', 'trendy', 'sports', 'new'],
      default: 'for_you',
    },
    soundId: { type: Schema.Types.ObjectId, ref: 'Sound' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

TemplateSchema.index({ category: 1 });
TemplateSchema.index({ usageCount: -1 });

export const Template = mongoose.model<ITemplate>('Template', TemplateSchema);
