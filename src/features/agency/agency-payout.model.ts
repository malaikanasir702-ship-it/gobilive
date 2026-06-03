import { Schema, model, Document } from 'mongoose';

export type PayoutStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

export interface IAgencyPayout extends Document {
  agencyId: string;
  agencyName: string;
  amount: number;
  method: string;
  details?: string;
  status: PayoutStatus;
  createdAt: Date;
  updatedAt: Date;
}

const AgencyPayoutSchema = new Schema<IAgencyPayout>(
  {
    agencyId: { type: String, required: true, index: true },
    agencyName: { type: String, required: true },
    amount: { type: Number, required: true },
    method: { type: String, required: true },
    details: { type: String },
    status: { type: String, enum: ['pending', 'completed', 'failed', 'cancelled'], default: 'pending' },
  },
  { timestamps: true }
);

export const AgencyPayout = model<IAgencyPayout>('AgencyPayout', AgencyPayoutSchema);

export default AgencyPayout;
