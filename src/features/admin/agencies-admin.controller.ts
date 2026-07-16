import { Response } from 'express';
import { Types } from 'mongoose';
import { Agency } from '../agency/agency.model';
import { User } from '../auth/user.model';
import WalletTransaction from '../wallet/wallet.transaction.model';
import LiveRoom from '../live/live.model';
import { logActivity } from '../activity-log/activity-log.service';
import { AdminAuthRequest } from '../../core/middlewares/rbac.middleware';

export const listAgencies = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
    const search = (req.query.search as string) || '';
    const status = req.query.status as string;
    const country = req.query.countryCode as string;

    const filter: any = {};
    if (search) { const re = new RegExp(search, 'i'); filter.$or = [{ name: re }, { agencyCode: re }, { ownerUsername: re }]; }
    if (status) filter.status = status;
    if (country) filter.countryCode = country.toUpperCase();
    // super_admin sees: agencies assigned to them OR agencies with no superAdminId
    // (legacy agencies created before ownership tracking was added)
    if (req.adminUser!.role === 'super_admin') {
      const saId = new Types.ObjectId(req.adminUser!.id);
      filter.$or = filter.$or
        ? [{ $and: [{ $or: filter.$or }, { $or: [{ superAdminId: saId }, { superAdminId: { $exists: false } }, { superAdminId: null }] }] }]
        : [{ superAdminId: saId }, { superAdminId: { $exists: false } }, { superAdminId: null }];
    }

    const total = await Agency.countDocuments(filter);
    const agencies = await Agency.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
    res.status(200).json({ success: true, agencies, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

export const getAgencyDetail = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const agency = await Agency.findById(id).lean();
    if (!agency) { res.status(404).json({ success: false, message: 'Agency not found.' }); return; }

    // Hosts may have agencyId set as either the MongoDB ObjectId string OR the agencyCode string
    // (old in-app host applications stored the agencyCode text, not the ObjectId)
    const agencyObjectId = new Types.ObjectId(id);
    const hosts = await User.find({
      $or: [
        { agencyId: agencyObjectId },
        { agencyId: id },
        { agencyId: (agency as any).agencyCode },
      ],
    }).select('username email phone diamonds rcoins beanWallet isBlocked isSuspended profilePic createdAt').lean();

    const hostIds = hosts.map(h => h._id);
    const transactions = await WalletTransaction.find({ userId: { $in: hostIds } }).sort({ createdAt: -1 }).limit(50).populate('userId', 'username').lean();
    const activeStreams = await LiveRoom.countDocuments({ isActive: true });
    res.status(200).json({ success: true, agency, hosts, transactions, activeStreams });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

export const getTop10Agencies = async (_req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const all = await Agency.find().lean();
    const agencies = all
      .map(a => ({ ...a, achievementPercent: a.target > 0 ? Math.round((a.targetAchieved / a.target) * 100) : 0 }))
      .sort((x, y) => y.achievementPercent - x.achievementPercent)
      .slice(0, 10);
    res.status(200).json({ success: true, agencies });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

export const approveAgency = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const agency = await Agency.findByIdAndUpdate(id, { status: 'active', isActive: true }, { new: true }).lean();
    if (!agency) { res.status(404).json({ success: false, message: 'Agency not found.' }); return; }
    await logActivity({ actorId: req.adminUser!.id, actorRole: req.adminUser!.role, actionType: 'approve_agency', targetEntityType: 'Agency', targetEntityId: id, description: `Approved agency ${agency.name}` });
    res.status(200).json({ success: true, agency });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

export const rejectAgency = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { reason } = req.body;
    const agency = await Agency.findByIdAndUpdate(id, { status: 'terminated', isActive: false }, { new: true }).lean();
    if (!agency) { res.status(404).json({ success: false, message: 'Agency not found.' }); return; }
    await logActivity({ actorId: req.adminUser!.id, actorRole: req.adminUser!.role, actionType: 'reject_agency', targetEntityType: 'Agency', targetEntityId: id, description: `Rejected agency ${agency.name}. Reason: ${reason || 'N/A'}` });
    res.status(200).json({ success: true, agency });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

export const blockAgency = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const agency = await Agency.findByIdAndUpdate(id, { status: 'blocked', isActive: false }, { new: true }).lean();
    if (!agency) { res.status(404).json({ success: false, message: 'Agency not found.' }); return; }
    await User.findByIdAndUpdate(agency.ownerId, { isBlocked: true, blockType: 'permanent' });
    await logActivity({ actorId: req.adminUser!.id, actorRole: req.adminUser!.role, actionType: 'block_agency', targetEntityType: 'Agency', targetEntityId: id, description: `Blocked agency ${agency.name}` });
    res.status(200).json({ success: true, agency });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

export const unblockAgency = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const agency = await Agency.findByIdAndUpdate(id, { status: 'active', isActive: true }, { new: true }).lean();
    if (!agency) { res.status(404).json({ success: false, message: 'Agency not found.' }); return; }
    await User.findByIdAndUpdate(agency.ownerId, { isBlocked: false, $unset: { blockedUntil: 1, blockType: 1 } });
    await logActivity({ actorId: req.adminUser!.id, actorRole: req.adminUser!.role, actionType: 'unblock_agency', targetEntityType: 'Agency', targetEntityId: id, description: `Unblocked agency ${agency.name}` });
    res.status(200).json({ success: true, agency });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

export const transferHosts = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { hostIds, targetAgencyId, transferAll } = req.body;
    if (!targetAgencyId) { res.status(400).json({ success: false, message: 'targetAgencyId is required.' }); return; }
    const targetAgency = await Agency.findById(targetAgencyId);
    if (!targetAgency) { res.status(404).json({ success: false, message: 'Target agency not found.' }); return; }
    const query: any = transferAll ? { agencyId: id } : { agencyId: id, _id: { $in: (hostIds as string[]).map(h => new Types.ObjectId(h)) } };
    const result = await User.updateMany(query, { agencyId: targetAgencyId });
    await logActivity({ actorId: req.adminUser!.id, actorRole: req.adminUser!.role, actionType: 'transfer_hosts', targetEntityType: 'Agency', targetEntityId: id, description: `Transferred ${result.modifiedCount} host(s) to ${targetAgency.name}` });
    res.status(200).json({ success: true, transferred: result.modifiedCount });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

export const terminateAgency = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const agency = await Agency.findByIdAndUpdate(id, { status: 'terminated', isActive: false }, { new: true }).lean();
    if (!agency) { res.status(404).json({ success: false, message: 'Agency not found.' }); return; }
    await User.findByIdAndUpdate(agency.ownerId, { isTerminated: true });
    await logActivity({ actorId: req.adminUser!.id, actorRole: req.adminUser!.role, actionType: 'terminate_agency', targetEntityType: 'Agency', targetEntityId: id, description: `Terminated agency ${agency.name}` });
    res.status(200).json({ success: true, agency });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

export const sendTerminationReason = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { reason } = req.body;
    if (!reason) { res.status(400).json({ success: false, message: 'Reason is required.' }); return; }
    const agency = await Agency.findById(id).lean();
    if (!agency) { res.status(404).json({ success: false, message: 'Agency not found.' }); return; }
    await logActivity({ actorId: req.adminUser!.id, actorRole: 'super_admin', actionType: 'termination_reason_sent', targetEntityType: 'Agency', targetEntityId: id, description: `Super Admin sent termination reason for agency ${agency.name}: ${reason}`, metadata: { reason } });
    res.status(200).json({ success: true, message: 'Termination reason sent to Company Admin.' });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};
