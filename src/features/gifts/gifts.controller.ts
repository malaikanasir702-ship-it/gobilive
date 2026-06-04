import { Response } from 'express';
import mongoose from 'mongoose';
import { GIFT_CATALOG, getGiftById } from './gift.config';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { addXpFromDiamondSpend } from '../auth/leveling.service';
import LiveRoom from '../live/live.model';
import { User } from '../auth/user.model';

export const getGiftCatalog = async (_req: AuthRequest, res: Response): Promise<void> => {
  res.status(200).json({ success: true, gifts: GIFT_CATALOG });
};

/**
 * Spend diamonds from sender and credit rcoins to host.
 * Falls back to non-transactional saves if replica set is unavailable.
 */
async function processGiftPayment(
  senderId: string,
  hostId: string,
  diamondCost: number,
  rcoinEarned: number,
  giftName: string
): Promise<void> {
  // Try with session/transaction first (works on Replica Sets)
  try {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const sender = await User.findById(senderId).session(session);
      if (!sender) throw new Error('Sender not found.');
      if (sender.diamonds < diamondCost) throw new Error('Insufficient diamonds.');
      sender.diamonds -= diamondCost;
      await sender.save({ session });

      const host = await User.findById(hostId).session(session);
      if (host && rcoinEarned > 0) {
        host.rcoins += rcoinEarned;
        await host.save({ session });
      }

      await session.commitTransaction();
      session.endSession();
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } catch (txErr: any) {
    // Fallback: non-transactional (for standalone MongoDB)
    const sender = await User.findById(senderId);
    if (!sender) throw new Error('Sender not found.');
    if (sender.diamonds < diamondCost) throw new Error('Insufficient diamonds.');
    sender.diamonds -= diamondCost;
    await sender.save();

    if (rcoinEarned > 0) {
      await User.findByIdAndUpdate(hostId, { $inc: { rcoins: rcoinEarned } });
    }
  }
}

export const sendGiftToHost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const { giftId, channelName, count = 1 } = req.body;

    if (!giftId || !channelName) {
      res.status(400).json({ success: false, message: 'giftId and channelName are required.' });
      return;
    }

    const gift = getGiftById(giftId);
    if (!gift) {
      res.status(400).json({ success: false, message: `Invalid gift id: ${giftId}` });
      return;
    }

    // Find room (allow slightly inactive for edge cases)
    const room = await LiveRoom.findOne({ channelName });
    if (!room) {
      res.status(404).json({ success: false, message: 'Live room not found.' });
      return;
    }

    const totalCost = gift.diamondCost * (count as number);
    const totalRcoins = gift.rcoinEarned * (count as number);

    await processGiftPayment(
      req.user.id,
      room.hostId.toString(),
      totalCost,
      totalRcoins,
      gift.name
    );

    // Update room gift stats
    room.totalGifts += (count as number);
    room.totalDiamondsEarned += totalCost;
    await room.save();

    // XP for sender (non-critical — don't fail request if this errors)
    try {
      await addXpFromDiamondSpend(req.user.id, totalCost);
    } catch (_) {}

    res.status(200).json({
      success: true,
      gift: { ...gift, count, totalCost, totalRcoins },
      hostId: room.hostId,
      senderUsername: req.user.username,
    });
  } catch (error: any) {
    console.error('[sendGiftToHost]', error);
    const knownClientErrors = ['Insufficient diamonds.', 'Sender not found.', 'Live room not found.'];
    const statusCode = knownClientErrors.includes(error.message) ? 400 : (error.status || 500);
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to send gift.',
    });
  }
};
