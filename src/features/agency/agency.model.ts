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
  },
  { timestamps: true }
);

export const Agency = model<IAgency>('Agency', AgencySchema);
