import { Response } from 'express';
import { User } from '../auth/user.model';
import { Agency } from '../agency/agency.model';
import { WithdrawalRequest } from '../withdrawal/withdrawal-request.model';
import { BeanTransaction } from '../beans/bean-transaction.model';
import LiveRoom from '../live/live.model';
import { logActivity } from '../activity-log/activity-log.service';
import { AdminAuthRequest } from '../../core/middlewares/rbac.middleware';
import { Types } from 'mongoose';

export const listHosts = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
    const search = (req.query.search as string) || '';
    const agency = (req.query.agency as string) || '';
    const status = (req.query.status as string) || '';

    const filter: any = { agencyId: { $exists: true, $ne: null } };
    if (search) { const re = new RegExp(search, 'i'); filter.$or = [{ username: re }]; }
    if (agency) filter.agencyId = agency;
    if (status === 'blocked') filter.isBlocked = true;
    if (status === 'suspended') filter.isSuspended = true;

    const total = await User.countDocuments(filter);
    const hosts = await User.find(filter)
      .select('username email phone diamonds beanWallet agencyId isBlocked isSuspended createdAt profilePic')
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();

    // Resolve agency names — agencyId may be ObjectId or agencyCode string
    const agencyIds = [...new Set(hosts.map(h => h.agencyId).filter(Boolean))];
    const agencyDocs = await Agency.find({
      $or: [
        { _id: { $in: agencyIds.filter(id => Types.ObjectId.isValid(String(id))) } },
        { agencyCode: { $in: agencyIds.map(String) } },
      ],
    }).select('_id agencyCode name').lean();

    const agencyMap = new Map<string, string>();
    for (const a of agencyDocs) {
      agencyMap.set(String(a._id), a.name);
      agencyMap.set(a.agencyCode, a.name);
    }

    const hostsWithAgency = hosts.map(h => ({
      ...h,
      agencyName: h.agencyId ? (agencyMap.get(String(h.agencyId)) ?? '—') : '—',
      agencyCode: h.agencyId ? (() => {
        const agency = agencyDocs.find(a => String(a._id) === String(h.agencyId) || a.agencyCode === String(h.agencyId));
        return agency?.agencyCode ?? String(h.agencyId);
      })() : '—',
    }));

    res.status(200).json({ success: true, hosts: hostsWithAgency, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

export const getHostProfile = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const user = await User.findById(id).select('-passwordHash -fcmTokens -twoFactorSecret -twoFactorPendingSecret').lean();
    if (!user) { res.status(404).json({ success: false, message: 'Host not found.' }); return; }

    const [withdrawals, beanTxs, liveRooms] = await Promise.all([
      WithdrawalRequest.find({ hostId: id }).sort({ createdAt: -1 }).limit(50).lean(),
      BeanTransaction.find({ toId: id }).sort({ createdAt: -1 }).limit(50).lean(),
      LiveRoom.find({ hostId: id }).sort({ createdAt: -1 }).limit(20).lean(),
    ]);

    res.status(200).json({ success: true, user, withdrawals, beanTransactions: beanTxs, liveHistory: liveRooms });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

export const blockHost = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { type, duration } = req.body;
    const update: any = { isBlocked: true };
    if (type === 'temporary' && duration) { const hours = parseInt(duration, 10) || 24; update.blockedUntil = new Date(Date.now() + hours * 3600 * 1000); update.blockType = 'temporary'; }
    else if (type === 'permanent') { update.blockType = 'permanent'; update.$unset = { blockedUntil: 1 }; }

    const user = await User.findByIdAndUpdate(id, update, { new: true }).select('username isBlocked blockedUntil blockType');
    if (!user) { res.status(404).json({ success: false, message: 'Host not found.' }); return; }
    if (update.blockType === 'permanent') await LiveRoom.updateMany({ hostId: id, isActive: true }, { isActive: false });

    await logActivity({ actorId: req.adminUser!.id, actorRole: req.adminUser!.role, actionType: 'block_host', targetEntityType: 'User', targetEntityId: id, description: `Blocked host ${user.username}` });
    res.status(200).json({ success: true, user });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

export const unblockHost = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const user = await User.findByIdAndUpdate(id, { isBlocked: false, $unset: { blockedUntil: 1, blockType: 1 } }, { new: true }).select('username isBlocked');
    if (!user) { res.status(404).json({ success: false, message: 'Host not found.' }); return; }
    await logActivity({ actorId: req.adminUser!.id, actorRole: req.adminUser!.role, actionType: 'unblock_host', targetEntityType: 'User', targetEntityId: id, description: `Unblocked host ${user.username}` });
    res.status(200).json({ success: true, user });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

export const approveHost = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const user = await User.findByIdAndUpdate(id, { isSuspended: false }, { new: true }).select('username isSuspended');
    if (!user) { res.status(404).json({ success: false, message: 'Host not found.' }); return; }
    await logActivity({ actorId: req.adminUser!.id, actorRole: req.adminUser!.role, actionType: 'approve_host', targetEntityType: 'User', targetEntityId: id, description: `Approved host ${user.username}` });
    res.status(200).json({ success: true, user });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

export const disapproveHost = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { reason } = req.body;
    const user = await User.findByIdAndUpdate(id, { isTerminated: true }, { new: true }).select('username isTerminated');
    if (!user) { res.status(404).json({ success: false, message: 'Host not found.' }); return; }
    await logActivity({ actorId: req.adminUser!.id, actorRole: req.adminUser!.role, actionType: 'disapprove_host', targetEntityType: 'User', targetEntityId: id, description: `Disapproved host ${user.username}. Reason: ${reason || 'N/A'}` });
    res.status(200).json({ success: true, user });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};

export const transferHostAgency = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { targetAgencyId } = req.body;
    if (!targetAgencyId) { res.status(400).json({ success: false, message: 'targetAgencyId is required.' }); return; }
    const user = await User.findByIdAndUpdate(id, { agencyId: targetAgencyId }, { new: true }).select('username agencyId');
    if (!user) { res.status(404).json({ success: false, message: 'Host not found.' }); return; }
    await logActivity({ actorId: req.adminUser!.id, actorRole: req.adminUser!.role, actionType: 'transfer_host_agency', targetEntityType: 'User', targetEntityId: id, description: `Transferred host ${user.username} to agency ${targetAgencyId}` });
    res.status(200).json({ success: true, user });
  } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
};
