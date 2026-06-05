import { Schema, model, Document, Types } from 'mongoose';

export interface IActivityLog extends Document {
  actorId: Types.ObjectId;
  actorRole: string;
  actionType: string;
  targetEntityType: string;
  targetEntityId: string;
  description: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actorRole: { type: String, required: true },
    actionType: { type: String, required: true },
    targetEntityType: { type: String, required: true },
    targetEntityId: { type: String, required: true },
    description: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ActivityLogSchema.index({ actorId: 1, createdAt: -1 });
ActivityLogSchema.index({ actionType: 1, createdAt: -1 });
ActivityLogSchema.index({ actorRole: 1, createdAt: -1 });
ActivityLogSchema.index({ targetEntityType: 1, targetEntityId: 1 });

export const ActivityLog = model<IActivityLog>('ActivityLog', ActivityLogSchema);
