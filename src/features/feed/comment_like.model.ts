import { Schema, model, Document, Types } from 'mongoose';

export type CommentReaction = 'like' | 'dislike';

export interface ICommentLike extends Document {
  commentId: Types.ObjectId;
  userId: Types.ObjectId;
  reaction: CommentReaction;
  createdAt: Date;
}

const CommentLikeSchema = new Schema<ICommentLike>({
  commentId: { type: Schema.Types.ObjectId, ref: 'Comment', required: true },
  userId:    { type: Schema.Types.ObjectId, ref: 'User',    required: true },
  reaction:  { type: String, enum: ['like', 'dislike'],    required: true },
  createdAt: { type: Date, default: Date.now },
});

// One reaction per user per comment
CommentLikeSchema.index({ commentId: 1, userId: 1 }, { unique: true });

export const CommentLike = model<ICommentLike>('CommentLike', CommentLikeSchema);
