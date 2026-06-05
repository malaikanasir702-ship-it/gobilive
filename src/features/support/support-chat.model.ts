import { Schema, model, Document, Types } from 'mongoose';

export interface ISupportMessage {
  _id?: Types.ObjectId;
  senderId: Types.ObjectId;
  senderRole: string;
  message: string;
  attachmentUrl?: string;
  createdAt: Date;
}

export interface ISupportChat extends Document {
  agencyId: Types.ObjectId;
  participantId: Types.ObjectId;
  participantRole: 'host' | 'user';
  messages: ISupportMessage[];
  lastMessageAt: Date;
  createdAt: Date;
}

const SupportMessageSchema = new Schema<ISupportMessage>(
  {
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String, required: true },
    message: { type: String, required: true },
    attachmentUrl: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const SupportChatSchema = new Schema<ISupportChat>(
  {
    agencyId: { type: Schema.Types.ObjectId, ref: 'Agency', required: true },
    participantId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    participantRole: { type: String, enum: ['host', 'user'], required: true },
    messages: { type: [SupportMessageSchema], default: [] },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

SupportChatSchema.index({ agencyId: 1, lastMessageAt: -1 });
SupportChatSchema.index({ participantId: 1 });

export const SupportChat = model<ISupportChat>('SupportChat', SupportChatSchema);
