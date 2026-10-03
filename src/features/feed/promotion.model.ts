import { Schema, model, Document, Types } from 'mongoose';

export interface IPromotionCampaign extends Document {
  promoterId: Types.ObjectId;
  postId: Types.ObjectId;
  goal: 'views' | 'followers' | 'visits';
  beansCost: number;
  targetCount: number;
  deliveredCount: number;
  status: 'active' | 'completed' | 'paused';
  frequencyCapSet: Array<{ userId: string; date: string }>;
  packageId?: Types.ObjectId;
  createdAt: Date;
}

const PromotionCampaignSchema = new Schema<IPromotionCampaign>(
  {
    promoterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    postId: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
    goal: { type: String, enum: ['views', 'followers', 'visits'], default: 'views' },
    beansCost: { type: Number, required: true },
    targetCount: { type: Number, required: true },
    deliveredCount: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'completed', 'paused'], default: 'active' },
    packageId: { type: Schema.Types.ObjectId, ref: 'PromotionPackage' },
    frequencyCapSet: [{ userId: { type: String }, date: { type: String } }],
  },
  { timestamps: true }
);

PromotionCampaignSchema.index({ status: 1, postId: 1 });
PromotionCampaignSchema.index({ status: 1, deliveredCount: 1 });

export const PromotionCampaign = model<IPromotionCampaign>('PromotionCampaign', PromotionCampaignSchema);

export interface IPromotionPackage extends Document {
  name: string;
  goal: 'views' | 'followers' | 'visits';
  beansCost: number;
  estimatedReach: number;
  durationDays: number;
  badgeText?: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const PromotionPackageSchema = new Schema<IPromotionPackage>(
  {
    name: { type: String, required: true },
    goal: { type: String, enum: ['views', 'followers', 'visits'], default: 'views' },
    beansCost: { type: Number, required: true },
    estimatedReach: { type: Number, required: true },
    durationDays: { type: Number, default: 1 },
    badgeText: { type: String, default: '' },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

PromotionPackageSchema.index({ isActive: 1, sortOrder: 1 });

export const PromotionPackage = model<IPromotionPackage>('PromotionPackage', PromotionPackageSchema);
