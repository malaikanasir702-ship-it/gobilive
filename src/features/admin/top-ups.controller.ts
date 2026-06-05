import { Response } from 'express';
import mongoose from 'mongoose';
import { User } from '../../auth/user.model';
import { BeanTransaction } from '../../beans/bean-transaction.model';
import { logActivity } from '../../activity-log/activity-log.service';
import { AdminAuthRequest } from '../../../core/middlewares/rbac.middleware';

// List Top Up Agents
export const listTopUpAgents = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
    const filter: any = { role: 'top_up_agent' };
    const search = (req.query.search as string) || '';
    if (search) {
      const re = new RegExp(search, 'i');
      filter.$or = [{ username: re }, { email: re }, { phone: re }];
    }
    const total = await User.countDocuments(filter);
    const items = await User.find(filter).select('username email phone beanWallet isBlocked isSuspended parentId createdAt').skip((page - 1) * limit).limit(limit).lean();
    res.status(200).json({ success: true, items, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const approveTopUpAgent = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndUpdate(id, { isSuspended: false }, { new: true }).select('username isSuspended');
    if (!user) return res.status(404).json({ success: false, message: 'Agent not found.' });
    await logActivity({ actorId: req.adminUser!.id, actorRole: req.adminUser!.role, actionType: 'approve_top_up_agent', targetEntityType: 'User', targetEntityId: id, description: `Approved top-up agent ${user.username}` });
    res.status(200).json({ success: true, user });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

export const rejectTopUpAgent = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params; const { reason } = req.body;
    const user = await User.findByIdAndUpdate(id, { isTerminated: true }, { new: true }).select('username isTerminated');
    if (!user) return res.status(404).json({ success: false, message: 'Agent not found.' });
    await logActivity({ actorId: req.adminUser!.id, actorRole: req.adminUser!.role, actionType: 'reject_top_up_agent', targetEntityType: 'User', targetEntityId: id, description: `Rejected top-up agent ${user.username}. Reason: ${reason || 'N/A'}` });
    res.status(200).json({ success: true, user });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

export const blockTopUpAgent = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params; const { type, durationHours } = req.body;
    const update: any = { isBlocked: true };
    if (type === 'temporary' && durationHours) update.blockedUntil = new Date(Date.now() + Number(durationHours) * 3600 * 1000);
    else if (type === 'permanent') { update.blockType = 'permanent'; update.$unset = { blockedUntil: 1 }; }
    const user = await User.findByIdAndUpdate(id, update, { new: true }).select('username isBlocked blockedUntil blockType');
    if (!user) return res.status(404).json({ success: false, message: 'Agent not found.' });
    await logActivity({ actorId: req.adminUser!.id, actorRole: req.adminUser!.role, actionType: 'block_top_up_agent', targetEntityType: 'User', targetEntityId: id, description: `Blocked top-up agent ${user.username}` });
    res.status(200).json({ success: true, user });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

export const unblockTopUpAgent = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndUpdate(id, { isBlocked: false, $unset: { blockedUntil: 1, blockType: 1 } }, { new: true }).select('username isBlocked');
    if (!user) return res.status(404).json({ success: false, message: 'Agent not found.' });
    await logActivity({ actorId: req.adminUser!.id, actorRole: req.adminUser!.role, actionType: 'unblock_top_up_agent', targetEntityType: 'User', targetEntityId: id, description: `Unblocked top-up agent ${user.username}` });
    res.status(200).json({ success: true, user });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

// List resellers (optionally under a top-up-agent)
export const listResellers = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
    const agentId = req.params.agentId || req.query.agentId;
    const filter: any = { role: 'reseller' };
    if (agentId) filter.parentId = agentId;
    const total = await User.countDocuments(filter);
    const items = await User.find(filter).select('username email phone beanWallet parentId isBlocked').skip((page - 1) * limit).limit(limit).lean();
    res.status(200).json({ success: true, items, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

export const approveReseller = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try { const { id } = req.params; const user = await User.findByIdAndUpdate(id, { isSuspended: false }, { new: true }).select('username isSuspended'); if (!user) return res.status(404).json({ success: false, message: 'Reseller not found.' }); await logActivity({ actorId: req.adminUser!.id, actorRole: req.adminUser!.role, actionType: 'approve_reseller', targetEntityType: 'User', targetEntityId: id, description: `Approved reseller ${user.username}` }); res.status(200).json({ success: true, user }); } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

export const rejectReseller = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try { const { id } = req.params; const { reason } = req.body; const user = await User.findByIdAndUpdate(id, { isTerminated: true }, { new: true }).select('username isTerminated'); if (!user) return res.status(404).json({ success: false, message: 'Reseller not found.' }); await logActivity({ actorId: req.adminUser!.id, actorRole: req.adminUser!.role, actionType: 'reject_reseller', targetEntityType: 'User', targetEntityId: id, description: `Rejected reseller ${user.username}. Reason: ${reason || 'N/A'}` }); res.status(200).json({ success: true, user }); } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

export const blockReseller = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try { const { id } = req.params; const update: any = { isBlocked: true }; const { type, durationHours } = req.body; if (type === 'temporary' && durationHours) update.blockedUntil = new Date(Date.now() + Number(durationHours) * 3600 * 1000); else if (type === 'permanent') { update.blockType = 'permanent'; update.$unset = { blockedUntil: 1 }; } const user = await User.findByIdAndUpdate(id, update, { new: true }).select('username isBlocked blockedUntil blockType'); if (!user) return res.status(404).json({ success: false, message: 'Reseller not found.' }); await logActivity({ actorId: req.adminUser!.id, actorRole: req.adminUser!.role, actionType: 'block_reseller', targetEntityType: 'User', targetEntityId: id, description: `Blocked reseller ${user.username}` }); res.status(200).json({ success: true, user }); } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

export const unblockReseller = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try { const { id } = req.params; const user = await User.findByIdAndUpdate(id, { isBlocked: false, $unset: { blockedUntil: 1, blockType: 1 } }, { new: true }).select('username isBlocked'); if (!user) return res.status(404).json({ success: false, message: 'Reseller not found.' }); await logActivity({ actorId: req.adminUser!.id, actorRole: req.adminUser!.role, actionType: 'unblock_reseller', targetEntityType: 'User', targetEntityId: id, description: `Unblocked reseller ${user.username}` }); res.status(200).json({ success: true, user }); } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

// Bean requests to company_admin (paginated)
export const getBeanRequestsForTopUp = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
    const filter: any = { type: 'request' };
    // company_admin sees all; top_up_agent sees only requests they made
    if (req.adminUser!.role === 'top_up_agent' || req.adminUser!.role === 'reseller') filter.fromId = req.adminUser!.id;
    const total = await BeanTransaction.countDocuments(filter);
    const items = await BeanTransaction.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
    res.status(200).json({ success: true, items, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

// Submit a bean request (top_up_agent -> company_admin)
export const submitBeanRequest = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { amount, transferSlipUrl } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Amount must be positive.' });
    const tx = await BeanTransaction.create([
      { type: 'request', fromId: req.adminUser!.id, fromRole: req.adminUser!.role, toId: undefined as any, toRole: 'company_admin', amount, transferSlipUrl, status: 'pending' },
    ], { session });
    await session.commitTransaction();
    await logActivity({ actorId: req.adminUser!.id, actorRole: req.adminUser!.role, actionType: 'submit_bean_request', targetEntityType: 'BeanTransaction', targetEntityId: tx[0]._id.toString(), description: `Requested ${amount} beans` });
    res.status(200).json({ success: true, request: tx[0] });
  } catch (err: any) { await session.abortTransaction(); res.status(500).json({ success: false, message: err.message }); } finally { session.endSession(); }
};

// Get bean transfer records
export const getBeanTransfers = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
    const filter: any = { type: { $in: ['assign', 'transfer'] } };
    if (req.adminUser!.role === 'top_up_agent' || req.adminUser!.role === 'reseller') filter.fromId = req.adminUser!.id;
    const total = await BeanTransaction.countDocuments(filter);
    const items = await BeanTransaction.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
    res.status(200).json({ success: true, items, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

// Submit a bean transfer (top_up_agent/reseller -> recipient user)
export const submitBeanTransfer = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { recipientId, amount, transferSlipUrl } = req.body;
    if (!recipientId || !amount || amount <= 0) return res.status(400).json({ success: false, message: 'recipientId and positive amount required.' });

    const sender = await User.findById(req.adminUser!.id).session(session).select('beanWallet role username');
    if (!sender) return res.status(404).json({ success: false, message: 'Sender not found.' });
    if (sender.beanWallet < amount) return res.status(400).json({ success: false, message: 'Insufficient bean wallet.' });

    const recipient = await User.findById(recipientId).session(session).select('beanWallet username role');
    if (!recipient) return res.status(404).json({ success: false, message: 'Recipient not found.' });

    await User.findByIdAndUpdate(sender._id, { $inc: { beanWallet: -amount } }, { session });
    await User.findByIdAndUpdate(recipient._id, { $inc: { beanWallet: amount } }, { session });

    const tx = await BeanTransaction.create([
      { type: 'transfer', fromId: sender._id, fromRole: sender.role, toId: recipient._id, toRole: recipient.role, amount, transferSlipUrl, status: 'completed' },
    ], { session });

    await session.commitTransaction();
    await logActivity({ actorId: req.adminUser!.id, actorRole: req.adminUser!.role, actionType: 'bean_transfer', targetEntityType: 'User', targetEntityId: recipient._id.toString(), description: `Transferred ${amount} beans to ${recipient.username}` });
    res.status(200).json({ success: true, transfer: tx[0] });
  } catch (err: any) { await session.abortTransaction(); res.status(500).json({ success: false, message: err.message }); } finally { session.endSession(); }
};
