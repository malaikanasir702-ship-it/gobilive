/**
 * notification.model.ts
 *
 * Persists every notification sent to a user so the notification page
 * can load history even after the app is reopened.
 *
 * Notification types currently stored:
 *   post_like     — someone liked your video
 *   post_comment  — someone commented on your video
 *   post_save     — someone saved your video
 *   follow        — someone followed you
 *   live_gift     — gift received in a live room
 *   pk_started    — PK battle started
 *   chat_message  — new direct message
 *   system        — generic platform message
 */

import mongoose, { Schema, Document } from 'mongoose';

export type NotificationType =
  | 'post_like'
  | 'post_comment'
  | 'post_save'
  | 'follow'
  | 'follow_request'
  | 'follow_request_accepted'
  | 'live_gift'
  | 'pk_started'
  | 'chat_message'
  | 'system';

export interface INotification extends Document {
  /** The user who should receive this notification */
  recipientId: mongoose.Types.ObjectId;
  /** The user who triggered the action (e.g. the liker) */
  actorId?: mongoose.Types.ObjectId;
  actorUsername?: string;
  actorProfilePic?: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Optional reference to the related post, room, etc. */
  referenceId?: string;
  /** Whether the user has tapped/seen the notification in-app */
  isRead: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    actorUsername: { type: String, default: '' },
    actorProfilePic: { type: String, default: '' },
    type: {
      type: String,
      enum: [
        'post_like',
        'post_comment',
        'post_save',
        'follow',
        'follow_request',
        'follow_request_accepted',
        'live_gift',
        'pk_started',
        'chat_message',
        'system',
      ],
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    referenceId: { type: String },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Most recent first, per recipient
NotificationSchema.index({ recipientId: 1, createdAt: -1 });

export default mongoose.model<INotification>('Notification', NotificationSchema);
