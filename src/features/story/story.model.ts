import { Schema, model, Document, Types } from 'mongoose';

export interface IStory extends Document {
  userId: Types.ObjectId;
  username: string;
  userProfilePic: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  viewedByUsers: Types.ObjectId[];
  createdAt: Date;
}

const StorySchema = new Schema<IStory>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  userProfilePic: { type: String, default: '' },
  mediaUrl: { type: String, required: true },
  mediaType: { type: String, enum: ['image', 'video'], default: 'image' },
  viewedByUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  // TTL index: MongoDB automatically deletes the document 24 hours after createdAt
  createdAt: { type: Date, default: Date.now, expires: 86400 },
});

// Index for fast chronological queries per user
StorySchema.index({ userId: 1, createdAt: -1 });

export const Story = model<IStory>('Story', StorySchema);
