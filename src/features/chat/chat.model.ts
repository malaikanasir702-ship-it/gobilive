import { Schema, model, Document, Types } from 'mongoose';

export interface IMessage extends Document {
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  senderUsername: string;
  text: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  postId?: Types.ObjectId;
  mediaType?: 'image' | 'sticker' | 'video' | 'post';
  status: 'sent' | 'delivered' | 'read';
  isUnsent: boolean;
  createdAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderUsername: { type: String, required: true },
    text: { type: String, default: '' },
    mediaUrl: { type: String },
    thumbnailUrl: { type: String },
    postId: { type: Schema.Types.ObjectId, ref: 'Post' },
    mediaType: { type: String, enum: ['image', 'sticker', 'video', 'post'] },
    status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
    isUnsent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Message = model<IMessage>('Message', MessageSchema);

export interface IConversation extends Document {
  participants: Types.ObjectId[];
  participantUsernames: string[];
  isGroup?: boolean;
  groupName?: string;
  groupAdmin?: Types.ObjectId;
  lastMessage?: string;
  lastMessageAt?: Date;
  createdAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    participants: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    participantUsernames: [{ type: String }],
    isGroup: { type: Boolean, default: false },
    groupName: { type: String },
    groupAdmin: { type: Schema.Types.ObjectId, ref: 'User' },
    lastMessage: { type: String },
    lastMessageAt: { type: Date },
  },
  { timestamps: true }
);

ConversationSchema.index({ participants: 1 });

export const Conversation = model<IConversation>('Conversation', ConversationSchema);
