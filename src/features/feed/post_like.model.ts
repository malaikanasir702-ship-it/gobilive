import { Schema, model, Document, Types } from 'mongoose';

export interface IPostLike extends Document {
  postId: Types.ObjectId;
  userId: Types.ObjectId;
  createdAt: Date;
}

const PostLikeSchema = new Schema<IPostLike>({
  postId:    { type: Schema.Types.ObjectId, ref: 'Post', required: true },
  userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
});

// Prevent multiple likes by the same user on the same post.
PostLikeSchema.index({ postId: 1, userId: 1 }, { unique: true });
PostLikeSchema.index({ userId: 1, createdAt: -1 });

export const PostLike = model<IPostLike>('PostLike', PostLikeSchema);

