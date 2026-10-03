import { Schema, model, Document, Types } from 'mongoose';

export interface IPromotionCampaign extends Document {
  promoterId: Types.ObjectId;
  postId: Types.ObjectId;
  goal: 'views' | 'followers' | 'visits';
  beansCost: number;
  targetCount: number;
  deliveredCount: number;
  status: 'active' | 'completed' | 'paused';
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
  },
  { timestamps: true }
);

PromotionCampaignSchema.index({ status: 1, postId: 1 });

export const PromotionCampaign = model<IPromotionCampaign>('PromotionCampaign', PromotionCampaignSchema);
