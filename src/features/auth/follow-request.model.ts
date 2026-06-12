import { Schema, model, Document, Types } from 'mongoose';

export type FollowRequestStatus = 'pending' | 'accepted' | 'rejected';

export interface IFollowRequest extends Document {
  fromId: Types.ObjectId;   // user who sent the request
  toId: Types.ObjectId;     // private account owner
  status: FollowRequestStatus;
  createdAt: Date;
}

const FollowRequestSchema = new Schema<IFollowRequest>(
  {
    fromId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    toId:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

// One pending request per pair at a time
FollowRequestSchema.index({ fromId: 1, toId: 1 }, { unique: true });
FollowRequestSchema.index({ toId: 1, status: 1 });

export const FollowRequest = model<IFollowRequest>('FollowRequest', FollowRequestSchema);
