import { Schema, model, Document, Types } from 'mongoose';

export interface IComment extends Document {
  postId: Types.ObjectId;
  userId: Types.ObjectId;
  username: string;
  userProfilePic: string;
  text: string;
  likesCount: number;
  dislikesCount: number;
  parentCommentId?: Types.ObjectId | null; // null = top-level, set = reply
  createdAt: Date;
}

const CommentSchema = new Schema<IComment>({
  postId:           { type: Schema.Types.ObjectId, ref: 'Post', required: true },
  userId:           { type: Schema.Types.ObjectId, ref: 'User', required: true },
  username:         { type: String, required: true },
  userProfilePic:   { type: String, default: '' },
  text:             { type: String, required: true, trim: true },
  likesCount:       { type: Number, default: 0 },
  dislikesCount:    { type: Number, default: 0 },
  parentCommentId:  { type: Schema.Types.ObjectId, ref: 'Comment', default: null },
  createdAt:        { type: Date, default: Date.now },
});

CommentSchema.index({ postId: 1, parentCommentId: 1, createdAt: -1 });

export const Comment = model<IComment>('Comment', CommentSchema);
