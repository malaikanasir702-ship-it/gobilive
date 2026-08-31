import { Schema, model, Document } from 'mongoose';

export type AgencyRankTier = 'Silver' | 'Copper' | 'Gold' | 'Diamond' | 'Platinum';

export interface AGENCY_TIER_INFO {
  tier: AgencyRankTier;
  minBeans: number;
  sharePercent: number;
}

export const AGENCY_TIERS: AGENCY_TIER_INFO[] = [
  { tier: 'Platinum', minBeans: 200_000_000, sharePercent: 15 },
  { tier: 'Diamond',  minBeans: 100_000_000, sharePercent: 12 },
  { tier: 'Gold',     minBeans: 25_000_000,  sharePercent: 8 },
  { tier: 'Copper',   minBeans: 5_000_000,   sharePercent: 5 },
  { tier: 'Silver',   minBeans: 0,           sharePercent: 3 },
];

export function getAgencyRankTier(monthlyBeans: number): AGENCY_TIER_INFO {
  for (const t of AGENCY_TIERS) {
    if (monthlyBeans >= t.minBeans) {
      return t;
    }
  }
  return AGENCY_TIERS[AGENCY_TIERS.length - 1];
}

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
  rankTier: AgencyRankTier;
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
    commissionPercent: { type: Number, default: 3 },
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
    sharePercent: { type: Number, default: 3 },
    rankTier: { type: String, enum: ['Silver', 'Copper', 'Gold', 'Diamond', 'Platinum'], default: 'Silver' },
    countryCode: { type: String, default: '' },
    status: { type: String, enum: ['active', 'terminated', 'blocked'], default: 'active' },
    superAdminId: { type: Schema.Types.ObjectId, ref: 'User', sparse: true },
    subAdminId: { type: Schema.Types.ObjectId, ref: 'User', sparse: true },
  },
  { timestamps: true }
);

AgencySchema.index({ targetAchieved: -1 });
AgencySchema.index({ superAdminId: 1 });
AgencySchema.index({ rankTier: 1 });

export const Agency = model<IAgency>('Agency', AgencySchema);
