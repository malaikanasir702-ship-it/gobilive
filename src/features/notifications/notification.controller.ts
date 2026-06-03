import { Response } from 'express';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import {
  registerFcmToken,
  removeFcmToken,
  sendToUser,
} from './notification.service';

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
