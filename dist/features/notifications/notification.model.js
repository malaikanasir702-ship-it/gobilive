"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const NotificationSchema = new mongoose_1.Schema({
    recipientId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    actorId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    actorUsername: { type: String, default: '' },
    actorProfilePic: { type: String, default: '' },
    type: {
        type: String,
        enum: [
            'post_like',
            'post_comment',
            'post_save',
            'user_mention',
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
}, { timestamps: true });
// Most recent first, per recipient
NotificationSchema.index({ recipientId: 1, createdAt: -1 });
exports.default = mongoose_1.default.model('Notification', NotificationSchema);
