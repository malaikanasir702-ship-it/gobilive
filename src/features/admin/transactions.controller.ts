import { Request, Response } from 'express';
import mongoose from 'mongoose';
import WalletTransaction from '../wallet/wallet.transaction.model';
import { BeanTransaction } from '../beans/bean-transaction.model';
import { WithdrawalRequest } from '../withdrawal/withdrawal-request.model';
import { User } from '../auth/user.model';
import { logActivity } from '../activity-log/activity-log.service';

// Universal tabbed transaction list
export async function listTransactions(req: Request, res: Response) {
  try {
    const { tab = 'beans', page = 1, limit = 20, userId, hostName, agencyCode, agencyName, from, to, status } = req.query as any;
    const skip = (Number(page) - 1) * Number(limit);

    if (tab === 'beans') {
      const filter: any = {};
      if (userId) filter.$or = [{ fromId: userId }, { toId: userId }];
      if (status) filter.status = status;
      if (from || to) { filter.createdAt = {}; if (from) filter.createdAt.$gte = new Date(from); if (to) filter.createdAt.$lte = new Date(to); }
      const total = await BeanTransaction.countDocuments(filter);
      const data = await BeanTransaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean();
      return res.json({ success: true, data, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
    }

    if (tab === 'withdrawals') {
      const filter: any = {};
      if (hostName) filter.hostName = new RegExp(hostName, 'i');
      if (agencyCode) filter.agencyCode = new RegExp(agencyCode, 'i');
      if (status) filter.status = status;
      if (from || to) { filter.requestedAt = {}; if (from) filter.requestedAt.$gte = new Date(from); if (to) filter.requestedAt.$lte = new Date(to); }
      const total = await WithdrawalRequest.countDocuments(filter);
      const data = await WithdrawalRequest.find(filter).sort({ requestedAt: -1 }).skip(skip).limit(Number(limit)).lean();
      return res.json({ success: true, data, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
    }

    // diamonds or d2b — WalletTransaction
    const filter: any = {};
    if (tab === 'diamonds') filter.currency = 'diamonds';
    if (tab === 'd2b') filter.type = 'convert_diamonds_to_rcoins';
    if (userId) filter.userId = userId;
    if (status) filter.status = status;
    if (from || to) { filter.createdAt = {}; if (from) filter.createdAt.$gte = new Date(from); if (to) filter.createdAt.$lte = new Date(to); }

    const total = await WalletTransaction.countDocuments(filter);
    const data = await WalletTransaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('userId', 'username email')
      .lean();

    res.json({ success: true, data, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getTransaction(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const doc = await WalletTransaction.findById(id).populate('userId', 'username email').lean();
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: doc });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function refundTransaction(req: Request, res: Response) {
  const { id } = req.params;
  const adminId = (req as any).adminUser?.id || 'system';
  const adminRole = (req as any).adminUser?.role || 'company_admin';

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const orig = await WalletTransaction.findById(id).session(session);
    if (!orig) { await session.abortTransaction(); session.endSession(); return res.status(404).json({ success: false, message: 'Not found' }); }
    if (orig.status !== 'completed') { await session.abortTransaction(); session.endSession(); return res.status(400).json({ success: false, message: 'Only completed transactions can be refunded' }); }

    const user = await User.findById(orig.userId).session(session);
    if (!user) { await session.abortTransaction(); session.endSession(); return res.status(404).json({ success: false, message: 'User not found' }); }

    const diamondsDelta = -(orig.diamondsDelta || 0);
    const rcoinsDelta = -(orig.rcoinsDelta || 0);

    const newDiamonds = (user.diamonds || 0) + diamondsDelta;
    const newRcoins = (user.rcoins || 0) + rcoinsDelta;
    if (newDiamonds < 0 || newRcoins < 0) { await session.abortTransaction(); session.endSession(); return res.status(400).json({ success: false, message: 'Refund would result in negative balance' }); }

    user.diamonds = newDiamonds;
    user.rcoins = newRcoins;
    await user.save({ session });

    const refundTx = await WalletTransaction.create([{
      userId: user._id, type: 'admin_adjust', currency: orig.currency,
      amount: orig.amount, diamondsDelta, rcoinsDelta,
      diamondsBalance: user.diamonds, rcoinsBalance: user.rcoins,
      status: 'completed', description: `Refund for tx ${orig._id}`,
      metadata: { refundedTxId: orig._id.toString(), adminId },
    }], { session });

    orig.status = 'cancelled';
    await orig.save({ session });

    await session.commitTransaction();
    session.endSession();

    await logActivity({
      actorId: adminId, actorRole: adminRole,
      actionType: 'refund_transaction', targetEntityType: 'WalletTransaction', targetEntityId: id,
      description: `Refunded transaction ${id} for user ${user.username}`,
    });

    res.json({ success: true, original: orig, refund: refundTx[0] });
  } catch (err: any) {
    await session.abortTransaction().catch(() => undefined);
    session.endSession();
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function manualAdjust(req: Request, res: Response) {
  const { userId, diamonds = 0, rcoins = 0, reason = 'manual adjustment' } = req.body as any;
  const adminId = (req as any).adminUser?.id || 'system';
  const adminRole = (req as any).adminUser?.role || 'company_admin';
  if (!userId) return res.status(400).json({ success: false, message: 'userId required' });

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const user = await User.findById(userId).session(session);
    if (!user) { await session.abortTransaction(); session.endSession(); return res.status(404).json({ success: false, message: 'User not found' }); }

    if ((user.diamonds || 0) + diamonds < 0 || (user.rcoins || 0) + rcoins < 0) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ success: false, message: 'Resulting balance would be negative' });
    }

    user.diamonds = (user.diamonds || 0) + diamonds;
    user.rcoins = (user.rcoins || 0) + rcoins;
    await user.save({ session });

    const tx = await WalletTransaction.create([{
      userId: user._id, type: 'admin_adjust',
      currency: diamonds !== 0 ? 'diamonds' : 'rcoins',
      amount: Math.abs(diamonds || rcoins),
      diamondsDelta: diamonds, rcoinsDelta: rcoins,
      diamondsBalance: user.diamonds, rcoinsBalance: user.rcoins,
      status: 'completed', description: `${reason}`, metadata: { adminId },
    }], { session });

    await session.commitTransaction();
    session.endSession();

    await logActivity({
      actorId: adminId, actorRole: adminRole,
      actionType: 'manual_adjust', targetEntityType: 'User', targetEntityId: userId,
      description: `Manual adjust: diamonds ${diamonds}, rcoins ${rcoins}. Reason: ${reason}`,
    });

    res.json({ success: true, data: tx[0] });
  } catch (err: any) {
    await session.abortTransaction().catch(() => undefined);
    session.endSession();
    res.status(500).json({ success: false, message: err.message });
  }
}

export default {};
