import { Response } from 'express';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { buildAgoraRtcToken } from '../../config/agora';
import { getPlatformSettings } from '../settings/platform-settings.model';
import { User } from '../auth/user.model';
import { spendVideoCallRcoins, WalletServiceError } from '../wallet/wallet.service';

interface QueueEntry {
  userId: string;
  username: string;
  joinedAt: number;
}

const matchQueue: QueueEntry[] = [];
const activeCalls: Record<string, { channelName: string; users: string[] }> = {};

export const joinMatchQueue = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const settings = await getPlatformSettings();
    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    if (user.rcoins < settings.videoCallRcoinCost) {
      res.status(400).json({
        success: false,
        message: `Need at least ${settings.videoCallRcoinCost} Beans for video calls.`,
      });
      return;
    }

    const userId = req.user!.id;
    const existing = matchQueue.find((e) => e.userId === userId);
    if (existing) {
      res.status(200).json({ success: true, status: 'waiting' });
      return;
    }

    matchQueue.push({
      userId,
      username: user.username,
      joinedAt: Date.now(),
    });

    const opponentIdx = matchQueue.findIndex((e) => e.userId !== userId);
    if (opponentIdx === -1) {
      res.status(200).json({ success: true, status: 'waiting' });
      return;
    }

    const opponent = matchQueue.splice(opponentIdx, 1)[0];
    const meIdx = matchQueue.findIndex((e) => e.userId === userId);
    if (meIdx !== -1) matchQueue.splice(meIdx, 1);

    const channelName = `call_${userId}_${opponent.userId}_${Date.now()}`;
    activeCalls[channelName] = { channelName, users: [userId, opponent.userId] };

    await spendVideoCallRcoins(userId, settings.videoCallRcoinCost);

    const token = buildAgoraRtcToken(channelName, 0, 'publisher');

    res.status(200).json({
      success: true,
      status: 'matched',
      match: {
        channelName,
        opponent: { userId: opponent.userId, username: opponent.username },
        agora: {
          appId: process.env.AGORA_APP_ID || '',
          channelName,
          uid: 0,
          token,
        },
      },
    });
  } catch (error: any) {
    const status = error instanceof WalletServiceError ? error.status : 500;
    res.status(status).json({ success: false, message: error.message });
  }
};

export const leaveMatchQueue = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized.' });
    return;
  }
  const idx = matchQueue.findIndex((e) => e.userId === req.user!.id);
  if (idx !== -1) matchQueue.splice(idx, 1);
  res.status(200).json({ success: true });
};

export const endVideoCall = async (req: AuthRequest, res: Response): Promise<void> => {
  const { channelName } = req.body;
  delete activeCalls[channelName];
  res.status(200).json({ success: true });
};

export const getCallToken = async (req: AuthRequest, res: Response): Promise<void> => {
  const channelName = String(req.params.channelName);
  const token = buildAgoraRtcToken(channelName, 0, 'publisher');
  res.status(200).json({
    success: true,
    agora: {
      appId: process.env.AGORA_APP_ID || '',
      channelName,
      uid: 0,
      token,
    },
  });
};
