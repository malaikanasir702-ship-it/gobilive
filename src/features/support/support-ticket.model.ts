import { Schema, model, Document, Types } from 'mongoose';

export interface ISupportMessage {
  _id?: Types.ObjectId;
  senderId: Types.ObjectId;
  senderRole: string;
  senderName: string;
  text: string;
  attachmentUrl?: string;
  createdAt: Date;
}

export interface ISupportTicket extends Document {
  userId: Types.ObjectId;
  userName: string;
  userProfilePic: string;
  messages: ISupportMessage[];
  status: 'open' | 'resolved' | 'closed';
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SupportMessageSchema = new Schema<ISupportMessage>(
  {
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String, required: true },
    senderName: { type: String, required: true },
    text: { type: String, required: true },
    attachmentUrl: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    userName: { type: String, required: true },
    userProfilePic: { type: String, default: '' },
    messages: { type: [SupportMessageSchema], default: [] },
    status: { type: String, enum: ['open', 'resolved', 'closed'], default: 'open' },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

SupportTicketSchema.index({ userId: 1 });
SupportTicketSchema.index({ status: 1, lastMessageAt: -1 });

export const SupportTicket = model<ISupportTicket>('SupportTicket', SupportTicketSchema);
