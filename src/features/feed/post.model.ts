import { Schema, model, Document, Types } from 'mongoose';

export interface IPost extends Document {
  userId: Types.ObjectId;
  username: string;
  userProfilePic: string;
  postType: 'video' | 'image';
  videoUrl: string;
  imageUrls: string[];
  thumbnailUrl: string;
  blurHash: string;       // BlurHash string for placeholder (generated on upload)
  aspectRatio: number;    // width/height — e.g. 0.5625 for 9:16 portrait
  caption: string;
  location?: string;
  allowComments: boolean;
  tags: string[];
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  viewsCount: number;
  duration: number; // in seconds
  isPublic: boolean;
  isArchived: boolean;
  createdAt: Date;
}

const PostSchema = new Schema<IPost>({
  userId:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
  username:       { type: String, required: true },
  userProfilePic: { type: String, default: '' },
  postType:       { type: String, enum: ['video', 'image'], default: 'video' },
  videoUrl:       { type: String, default: '' },
  imageUrls:      { type: [String], default: [] },
  thumbnailUrl:   { type: String, default: '' },
  blurHash:       { type: String, default: '' },   // e.g. "LGF5]+Yk^6#M@-5c,1J5@[or[Q6."
  aspectRatio:    { type: Number, default: 0.5625 }, // default 9:16 portrait
  caption:        { type: String, default: '' },
  location:       { type: String, default: '' },
  allowComments:  { type: Boolean, default: true },
  tags:           [{ type: String }],
  likesCount:     { type: Number, default: 0 },
  commentsCount:  { type: Number, default: 0 },
  sharesCount:    { type: Number, default: 0 },
  viewsCount:     { type: Number, default: 0 },
  duration:       { type: Number, default: 0 },
  isPublic:       { type: Boolean, default: true },
  isArchived:     { type: Boolean, default: false },
  createdAt:      { type: Date, default: Date.now },
});

// Index for fast chronological feed queries
PostSchema.index({ createdAt: -1 });
PostSchema.index({ likesCount: -1 });

export const Post = model<IPost>('Post', PostSchema);
