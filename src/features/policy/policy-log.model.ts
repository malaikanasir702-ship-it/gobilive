import { Schema, model, Document, Types } from 'mongoose';

export interface IPolicyLog extends Document {
  policyName: string;
  previousValue: any;
  newValue: any;
  changedBy: Types.ObjectId;
  countryCode?: string;
  createdAt: Date;
}

const PolicyLogSchema = new Schema<IPolicyLog>(
  {
    policyName: { type: String, required: true, index: true },
    previousValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    countryCode: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

PolicyLogSchema.index({ policyName: 1, createdAt: -1 });

export const PolicyLog = model<IPolicyLog>('PolicyLog', PolicyLogSchema);
