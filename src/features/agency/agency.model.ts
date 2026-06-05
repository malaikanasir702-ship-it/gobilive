import { Schema, model, Document } from 'mongoose';

export interface IAgency extends Document {
  name: string;
  ownerId: string;
  ownerUsername: string;
  commissionPercent: number;
  walletBalance: number;
  streamerIds: string[];
  totalEarnings: number;
  isActive: boolean;
  createdAt: Date;
  // Admin panel extensions
  agencyCode: string;
  parentAgencyId?: Schema.Types.ObjectId;
  subAgencyIds: Schema.Types.ObjectId[];
  target: number;
  targetAchieved: number;
  sharePercent: number;
  countryCode: string;
  status: 'active' | 'terminated' | 'blocked';
  superAdminId?: Schema.Types.ObjectId;
  subAdminId?: Schema.Types.ObjectId;
}

const AgencySchema = new Schema<IAgency>(
  {
    name: { type: String, required: true },
    ownerId: { type: String, required: true },
    ownerUsername: { type: String, required: true },
    commissionPercent: { type: Number, default: 15 },
    walletBalance: { type: Number, default: 0 },
    streamerIds: { type: [String], default: [] },
    totalEarnings: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    // Admin panel extensions
    agencyCode: { type: String, unique: true, sparse: true },
    parentAgencyId: { type: Schema.Types.ObjectId, ref: 'Agency', sparse: true },
    subAgencyIds: { type: [Schema.Types.ObjectId], ref: 'Agency', default: [] },
    target: { type: Number, default: 0 },
    targetAchieved: { type: Number, default: 0 },
    sharePercent: { type: Number, default: 0 },
    countryCode: { type: String, default: '' },
    status: { type: String, enum: ['active', 'terminated', 'blocked'], default: 'active' },
    superAdminId: { type: Schema.Types.ObjectId, ref: 'User', sparse: true },
    subAdminId: { type: Schema.Types.ObjectId, ref: 'User', sparse: true },
  },
  { timestamps: true }
);

AgencySchema.index({ targetAchieved: -1 });
AgencySchema.index({ superAdminId: 1 });

export const Agency = model<IAgency>('Agency', AgencySchema);
