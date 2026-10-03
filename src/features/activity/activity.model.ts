import { Schema, model, Document, Types } from 'mongoose';

export type ActivityType =
  | 'profile_view'
  | 'follow'
  | 'follow_request'
  | 'follow_request_accepted'
  | 'like_post'
  | 'like_comment'
  | 'comment_post'
  | 'reply_comment'
  | 'mention'
  | 'tag'
  | 'save_post'
  | 'repost_post'
  | 'share_post'
  | 'live_gift';

export interface IGroupedActor {
  actorId: Types.ObjectId;
  username: string;
  profilePic?: string;
  displayName?: string;
  createdAt: Date;
}

export interface IActivity extends Document {
  recipientId: Types.ObjectId;
  actorId: Types.ObjectId;
  actorUsername: string;
  actorProfilePic: string;
  actorDisplayName?: string;
  type: ActivityType;
  postId?: Types.ObjectId;
  commentId?: Types.ObjectId;
  postThumbnailUrl?: string;
  commentText?: string;
  metadata?: Record<string, any>;
  groupedActors: IGroupedActor[];
  count: number;
  isRead: boolean;
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const GroupedActorSchema = new Schema<IGroupedActor>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    profilePic: { type: String, default: '' },
    displayName: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ActivitySchema = new Schema<IActivity>(
  {
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    actorUsername: { type: String, required: true, trim: true },
    actorProfilePic: { type: String, default: '' },
    actorDisplayName: { type: String, default: '' },
    type: {
      type: String,
      enum: [
        'profile_view',
        'follow',
        'follow_request',
        'follow_request_accepted',
        'like_post',
        'like_comment',
        'comment_post',
        'reply_comment',
        'mention',
        'tag',
        'save_post',
        'repost_post',
        'share_post',
        'live_gift',
      ],
      required: true,
    },
    postId: { type: Schema.Types.ObjectId, ref: 'Post' },
    commentId: { type: Schema.Types.ObjectId, ref: 'Comment' },
    postThumbnailUrl: { type: String, default: '' },
    commentText: { type: String, default: '' },
    metadata: { type: Schema.Types.Mixed },
    groupedActors: { type: [GroupedActorSchema], default: [] },
    count: { type: Number, default: 1 },
    isRead: { type: Boolean, default: false },
    idempotencyKey: { type: String, sparse: true, unique: true },
  },
  { timestamps: true }
);

// Indexes for fast chronological feed queries, category filters & unread badges
ActivitySchema.index({ recipientId: 1, createdAt: -1 });
ActivitySchema.index({ recipientId: 1, type: 1, createdAt: -1 });
ActivitySchema.index({ recipientId: 1, isRead: 1 });
ActivitySchema.index({ recipientId: 1, postId: 1, type: 1 });

export const Activity = model<IActivity>('Activity', ActivitySchema);
