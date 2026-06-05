import { Schema, model, Document, Types } from 'mongoose';

export type WithdrawalStatus = 'pending' | 'approved' | 'done' | 'rejected';

export interface IWithdrawalRequest extends Document {
  hostId: Types.ObjectId;
  hostName: string;
  agencyId?: Types.ObjectId;
  superAdminId?: Types.ObjectId;
  diamondsRequested: number;
  amountInLocalCurrency: number;
  currencyCode: string;
  status: WithdrawalStatus;
  transferSlipUrl?: string;
  rejectionReason?: string;
  requestedAt: Date;
  approvedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

const WithdrawalRequestSchema = new Schema<IWithdrawalRequest>(
  {
    hostId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    hostName: { type: String, required: true },
    agencyId: { type: Schema.Types.ObjectId, ref: 'Agency', sparse: true },
    superAdminId: { type: Schema.Types.ObjectId, ref: 'User', sparse: true },
    diamondsRequested: { type: Number, required: true, min: 1 },
    amountInLocalCurrency: { type: Number, required: true, min: 0 },
    currencyCode: { type: String, required: true, default: 'PKR' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'done', 'rejected'],
      default: 'pending',
    },
    transferSlipUrl: { type: String },
    rejectionReason: { type: String },
    requestedAt: { type: Date, default: Date.now },
    approvedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

WithdrawalRequestSchema.index({ hostId: 1, createdAt: -1 });
WithdrawalRequestSchema.index({ superAdminId: 1, status: 1 });
WithdrawalRequestSchema.index({ status: 1, createdAt: -1 });
WithdrawalRequestSchema.index({ agencyId: 1, createdAt: -1 });

export const WithdrawalRequest = model<IWithdrawalRequest>(
  'WithdrawalRequest',
  WithdrawalRequestSchema
);
