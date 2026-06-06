import { Response } from 'express';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import {
  registerFcmToken,
  removeFcmToken,
  sendToUser,
} from './notification.service';
import Notification from './notification.model';

export const registerToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { token, platform } = req.body;
    if (!token) {
      res.status(400).json({ success: false, message: 'FCM token is required.' });
      return;
    }
    const result = await registerFcmToken(req.user!.id, token, platform);
    res.status(200).json({ success: true, ...result });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const unregisterToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    if (!token) {
      res.status(400).json({ success: false, message: 'FCM token is required.' });
      return;
    }
    await removeFcmToken(req.user!.id, token);
    res.status(200).json({ success: true, message: 'Token removed.' });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const sendTestNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, body } = req.body;
    const result = await sendToUser(req.user!.id, {
      title: title || 'Gobilive Test',
      body: body || 'Push notifications are working!',
      data: { type: 'test' },
    });
    res.status(200).json({ success: true, result });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// GET /notifications — paginated history for current user
export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page  = parseInt(req.query.page  as string) || 1;
    const limit = parseInt(req.query.limit as string) || 30;
    const skip  = (page - 1) * limit;

    const notifications = await Notification.find({ recipientId: req.user!.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const unreadCount = await Notification.countDocuments({
      recipientId: req.user!.id,
      isRead: false,
    });

    res.status(200).json({ success: true, notifications, unreadCount });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// PATCH /notifications/read-all — mark all as read
export const markAllRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Notification.updateMany(
      { recipientId: req.user!.id, isRead: false },
      { $set: { isRead: true } }
    );
    res.status(200).json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// PATCH /notifications/:id/read — mark single notification as read
export const markOneRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, recipientId: req.user!.id },
      { $set: { isRead: true } }
    );
    res.status(200).json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};
