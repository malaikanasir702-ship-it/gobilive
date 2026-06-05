import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { WithdrawalRequest } from '../withdrawal/withdrawal-request.model';
import { logActivity } from '../activity-log/activity-log.service';
import WalletTransaction from '../wallet/wallet.transaction.model';
import { User } from '../auth/user.model';

export async function listWithdrawals(req: Request, res: Response) {
  try {
    const { status, hostName, agencyId, page = 1, limit = 20, from, to } = req.query as any;
    const filter: any = {};
    if (status) filter.status = status;
    if (agencyId) filter.agencyId = agencyId;
    if (hostName) filter.hostName = new RegExp(hostName, 'i');
    if (from || to) { filter.requestedAt = {}; if (from) filter.requestedAt.$gte = new Date(from); if (to) filter.requestedAt.$lte = new Date(to); }

    const total = await WithdrawalRequest.countDocuments(filter);
    const docs = await WithdrawalRequest.find(filter)
      .sort({ requestedAt: -1 })
      .skip((page - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    res.json({ success: true, data: docs, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getWithdrawal(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const doc = await WithdrawalRequest.findById(id).lean();
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: doc });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function approveWithdrawal(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const adminId = (req as any).adminUser?.id || 'system';
    const adminRole = (req as any).adminUser?.role || 'super_admin';
    const doc = await WithdrawalRequest.findByIdAndUpdate(
      id,
      { status: 'approved', approvedAt: new Date(), superAdminId: adminId },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });

    await logActivity({
      actorId: adminId, actorRole: adminRole,
      actionType: 'approve_withdrawal', targetEntityType: 'WithdrawalRequest', targetEntityId: id,
      description: `Approved withdrawal of ${doc.diamondsRequested} diamonds for ${doc.hostName}`,
    });

    res.json({ success: true, data: doc });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function rejectWithdrawal(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const { reason } = req.body;
    const adminId = (req as any).adminUser?.id || 'system';
    const adminRole = (req as any).adminUser?.role || 'super_admin';
    const doc = await WithdrawalRequest.findByIdAndUpdate(
      id,
      { status: 'rejected', rejectionReason: reason },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });

    await logActivity({
      actorId: adminId, actorRole: adminRole,
      actionType: 'reject_withdrawal', targetEntityType: 'WithdrawalRequest', targetEntityId: id,
      description: `Rejected withdrawal for ${doc.hostName}. Reason: ${reason || 'N/A'}`,
    });

    res.json({ success: true, data: doc });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function markWithdrawalDone(req: Request, res: Response) {
  const id = String(req.params.id);
  const adminId = (req as any).adminUser?.id || 'system';
  const adminRole = (req as any).adminUser?.role || 'super_admin';
  const slipFile = (req as any).file as Express.Multer.File | undefined;
  const { transferSlipUrl: slipUrlBody } = req.body;

  const slipUrl = slipFile
    ? `${req.protocol}://${req.get('host')}/uploads/${slipFile.filename}`
    : slipUrlBody;

  if (!slipUrl) {
    res.status(400).json({ success: false, message: 'Transfer slip (file or URL) is required to mark withdrawal as done.' });
    return;
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const withdrawal = await WithdrawalRequest.findById(id).session(session);
    if (!withdrawal) { await session.abortTransaction(); session.endSession(); return res.status(404).json({ success: false, message: 'Not found' }); }
    if (withdrawal.status === 'done') { await session.abortTransaction(); session.endSession(); return res.status(400).json({ success: false, message: 'Already completed' }); }

    const user = await User.findById(withdrawal.hostId).session(session);
    if (!user) { await session.abortTransaction(); session.endSession(); return res.status(404).json({ success: false, message: 'Host user not found' }); }

    withdrawal.transferSlipUrl = slipUrl;
    withdrawal.status = 'done';
    withdrawal.completedAt = new Date();
    await withdrawal.save({ session });

    await WalletTransaction.create([{
      userId: user._id,
      type: 'withdraw_rcoins',
      currency: 'diamonds',
      amount: withdrawal.amountInLocalCurrency,
      diamondsDelta: -withdrawal.diamondsRequested,
      rcoinsDelta: 0,
      diamondsBalance: user.diamonds,
      rcoinsBalance: user.rcoins,
      status: 'completed',
      description: `Withdrawal payout - ${withdrawal.amountInLocalCurrency} ${withdrawal.currencyCode}`,
      transferSlipUrl: slipUrl,
    }], { session });

    await session.commitTransaction();
    session.endSession();

    await logActivity({
      actorId: adminId, actorRole: adminRole,
      actionType: 'complete_withdrawal', targetEntityType: 'WithdrawalRequest', targetEntityId: id,
      description: `Completed withdrawal of ${withdrawal.diamondsRequested} diamonds for ${withdrawal.hostName}`,
      metadata: { slipUrl },
    });

    res.json({ success: true, data: withdrawal });
  } catch (err: any) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function attachTransferSlip(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const { transferSlipUrl } = req.body;
    if (!transferSlipUrl) return res.status(400).json({ success: false, message: 'transferSlipUrl required' });
    const doc = await WithdrawalRequest.findByIdAndUpdate(id, { transferSlipUrl }, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: doc });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function attachSlipFile(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const url = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
    const doc = await WithdrawalRequest.findByIdAndUpdate(id, { transferSlipUrl: url }, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    res.status(201).json({ success: true, url, data: doc });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export default {};
