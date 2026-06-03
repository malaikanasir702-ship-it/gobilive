import mongoose, { Schema, Document } from 'mongoose';

export interface IStreamReport extends Document {
  reporterUsername: string;
  hostUsername: string;
  roomId: string;
  reason: string;
  createdAt: Date;
}

const StreamReportSchema = new Schema<IStreamReport>({
  reporterUsername: { type: String, required: true },
  hostUsername: { type: String, required: true },
  roomId: { type: String, required: true },
  reason: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<IStreamReport>('StreamReport', StreamReportSchema);
