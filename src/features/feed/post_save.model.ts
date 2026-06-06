import { Schema, model, Document, Types } from 'mongoose';

export interface IPostSave extends Document {
  postId: Types.ObjectId;
  userId: Types.ObjectId;
  createdAt: Date;
}

const PostSaveSchema = new Schema<IPostSave>({
  postId:    { type: Schema.Types.ObjectId, ref: 'Post', required: true },
  userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
});

// One save per user per post
PostSaveSchema.index({ postId: 1, userId: 1 }, { unique: true });
PostSaveSchema.index({ userId: 1, createdAt: -1 });

export const PostSave = model<IPostSave>('PostSave', PostSaveSchema);
