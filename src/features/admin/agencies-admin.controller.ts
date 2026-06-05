import { Response } from 'express';
import { Types } from 'mongoose';
import { Agency } from '../../agency/agency.model';
import { User } from '../../auth/user.model';
import LiveRoom from '../../live/live.model';
import { logActivity } from '../../activity-log/activity-log.service';
import { AdminAuthRequest } from '../../../core/middlewares/rbac.middleware';

// List agencies with filters
export const listAgencies = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
    const search = (req.query.search as string) || '';
    const status = req.query.status as string;
    const country = req.query.country as string;

    const filter: any = {};
    if (search) {
      const re = new RegExp(search, 'i');
      filter.$or = [{ name: re }, { agencyCode: re }];
    }
    if (status) filter.status = status;
    if (country) filter.countryCode = country.toUpperCase();

    const total = await Agency.countDocuments(filter);
    const agencies = await Agency.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.status(200).json({ success: true, agencies, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get agency detail: hosts, transactions summary (approx), activity counts
export const getAgencyDetail = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const agency = await Agency.findById(id).lean();
    if (!agency) {
      res.status(404).json({ success: false, message: 'Agency not found.' });
      return;
    }

    const hosts = await User.find({ agencyId: agency._id }).select('username createdAt isBlocked isSuspended beanWallet diamonds').limit(100).lean();
    const activeStreams = await LiveRoom.countDocuments({ agencyId: agency._id, isActive: true });

    res.status(200).json({ success: true, agency, hosts, activeStreams });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Terminate agency
export const terminateAgency = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { transferToAgencyId } = req.body;

    const agency = await Agency.findByIdAndUpdate(id, { status: 'terminated' }, { new: true }).lean();
    if (!agency) {
      res.status(404).json({ success: false, message: 'Agency not found.' });
      return;
    }

    // If transfer target provided, reassign hosts
    if (transferToAgencyId) {
      await User.updateMany({ agencyId: agency._id }, { agencyId: transferToAgencyId });
    }

    await logActivity({
      actorId: req.adminUser!.id,
      actorRole: req.adminUser!.role,
      actionType: 'terminate_agency',
      targetEntityType: 'Agency',
      targetEntityId: id,
      description: `Terminated agency ${agency.name}`,
    });

    res.status(200).json({ success: true, agency });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Transfer hosts (specific or all)
export const transferHosts = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // source agency id
    const { targetAgencyId, hostIds, transferAll } = req.body;
    if (!targetAgencyId) {
      res.status(400).json({ success: false, message: 'targetAgencyId is required.' });
      return;
    }

    const target = await Agency.findById(targetAgencyId).select('_id name');
    if (!target) {
      res.status(404).json({ success: false, message: 'Target agency not found.' });
      return;
    }

    let result;
    if (transferAll) {
      result = await User.updateMany({ agencyId: id }, { agencyId: targetAgencyId });
    } else if (Array.isArray(hostIds) && hostIds.length > 0) {
      const objIds = hostIds.map((h: string) => Types.ObjectId(h));
      result = await User.updateMany({ _id: { $in: objIds }, agencyId: id }, { agencyId: targetAgencyId });
    } else {
      res.status(400).json({ success: false, message: 'hostIds or transferAll must be provided.' });
      return;
    }

    await logActivity({
      actorId: req.adminUser!.id,
      actorRole: req.adminUser!.role,
      actionType: 'transfer_hosts',
      targetEntityType: 'Agency',
      targetEntityId: id,
      description: `Transferred hosts from agency ${id} to ${target._id}`,
      metadata: { result },
    });

    res.status(200).json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Block / Unblock agency
export const blockAgency = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const agency = await Agency.findByIdAndUpdate(id, { status: 'blocked' }, { new: true }).lean();
    if (!agency) {
      res.status(404).json({ success: false, message: 'Agency not found.' });
      return;
    }
    await logActivity({
      actorId: req.adminUser!.id,
      actorRole: req.adminUser!.role,
      actionType: 'block_agency',
      targetEntityType: 'Agency',
      targetEntityId: id,
      description: `Blocked agency ${agency.name}`,
    });
    res.status(200).json({ success: true, agency });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const unblockAgency = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const agency = await Agency.findByIdAndUpdate(id, { status: 'active' }, { new: true }).lean();
    if (!agency) {
      res.status(404).json({ success: false, message: 'Agency not found.' });
      return;
    }
    await logActivity({
      actorId: req.adminUser!.id,
      actorRole: req.adminUser!.role,
      actionType: 'unblock_agency',
      targetEntityType: 'Agency',
      targetEntityId: id,
      description: `Unblocked agency ${agency.name}`,
    });
    res.status(200).json({ success: true, agency });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Approve / Reject agency (super admin)
export const approveAgency = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const agency = await Agency.findByIdAndUpdate(id, { status: 'active' }, { new: true }).lean();
    if (!agency) {
      res.status(404).json({ success: false, message: 'Agency not found.' });
      return;
    }
    await logActivity({
      actorId: req.adminUser!.id,
      actorRole: req.adminUser!.role,
      actionType: 'approve_agency',
      targetEntityType: 'Agency',
      targetEntityId: id,
      description: `Approved agency ${agency.name}`,
    });
    res.status(200).json({ success: true, agency });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const rejectAgency = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const agency = await Agency.findByIdAndUpdate(id, { status: 'terminated' }, { new: true }).lean();
    if (!agency) {
      res.status(404).json({ success: false, message: 'Agency not found.' });
      return;
    }
    await logActivity({
      actorId: req.adminUser!.id,
      actorRole: req.adminUser!.role,
      actionType: 'reject_agency',
      targetEntityType: 'Agency',
      targetEntityId: id,
      description: `Rejected agency ${agency.name}. Reason: ${reason || 'N/A'}`,
    });
    res.status(200).json({ success: true, agency });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const sendTerminationReason = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const agency = await Agency.findById(id).lean();
    if (!agency) {
      res.status(404).json({ success: false, message: 'Agency not found.' });
      return;
    }
    await logActivity({
      actorId: req.adminUser!.id,
      actorRole: req.adminUser!.role,
      actionType: 'send_termination_reason',
      targetEntityType: 'Agency',
      targetEntityId: id,
      description: `Sent termination reason to company admin: ${message}`,
    });
    res.status(200).json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getTop10Agencies = async (_req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const agencies = await Agency.find()
      .lean()
      .then((list) =>
        list
          .map((a) => ({
            ...a,
            targetPct: a.target && a.target > 0 ? (a.targetAchieved / a.target) * 100 : 0,
          }))
          .sort((x, y) => (y.targetPct as number) - (x.targetPct as number))
          .slice(0, 10)
      );
    res.status(200).json({ success: true, agencies });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
import { Response } from 'express';
import { Agency } from '../agency/agency.model';
import { User } from '../auth/user.model';
import WalletTransaction from '../wallet/wallet.transaction.model';
import { logActivity } from '../activity-log/activity-log.service';
import { AdminAuthRequest } from '../../core/middlewares/rbac.middleware';

// ─── List Agencies ────────────────────────────────────────────────────────────

export const listAgencies = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
    const search = (req.query.search as string) || '';
    const status = req.query.status as string;
    const countryCode = req.query.countryCode as string;
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;

    const filter: any = {};
    if (search) {
      const re = new RegExp(search, 'i');
      filter.$or = [{ name: re }, { agencyCode: re }, { ownerUsername: re }];
    }
    if (status) filter.status = status;
    if (countryCode) filter.countryCode = countryCode.toUpperCase();
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    // Scope to super_admin's agencies if applicable
    if (req.adminUser!.role === 'super_admin') {
      filter.superAdminId = req.adminUser!.id;
    }

    const total = await Agency.countDocuments(filter);
    const agencies = await Agency.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      agencies,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Get Agency Detail ────────────────────────────────────────────────────────

export const getAgencyDetail = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const agency = await Agency.findById(id).lean();
    if (!agency) {
      res.status(404).json({ success: false, message: 'Agency not found.' });
      return;
    }

    // Get all hosts (streamers) in this agency
    const hosts = await User.find({ agencyId: id })
      .select('username email phone diamonds rcoins beanWallet isBlocked isSuspended profilePic createdAt')
      .lean();

    // Recent transactions for this agency
    const hostIds = hosts.map(h => h._id);
    const transactions = await WalletTransaction.find({ userId: { $in: hostIds } })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('userId', 'username')
      .lean();

    res.status(200).json({ success: true, agency, hosts, transactions });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Top 10 Agencies ──────────────────────────────────────────────────────────

export const getTop10Agencies = async (_req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const agencies = await Agency.find({ status: 'active', target: { $gt: 0 } })
      .sort({ targetAchieved: -1 })
      .limit(10)
      .select('name agencyCode target targetAchieved sharePercent countryCode ownerUsername')
      .lean();

    const result = agencies.map(a => ({
      ...a,
      achievementPercent: a.target > 0 ? Math.round((a.targetAchieved / a.target) * 100) : 0,
    }));

    res.status(200).json({ success: true, agencies: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Approve / Reject Agency ──────────────────────────────────────────────────

export const approveAgency = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const agency = await Agency.findByIdAndUpdate(id, { status: 'active', isActive: true }, { new: true });
    if (!agency) {
      res.status(404).json({ success: false, message: 'Agency not found.' });
      return;
    }
    await logActivity({
      actorId: req.adminUser!.id,
      actorRole: req.adminUser!.role,
      actionType: 'approve_agency',
      targetEntityType: 'Agency',
      targetEntityId: id,
      description: `Approved agency ${agency.name}`,
    });
    res.status(200).json({ success: true, agency });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const rejectAgency = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const agency = await Agency.findByIdAndUpdate(id, { status: 'terminated', isActive: false }, { new: true });
    if (!agency) {
      res.status(404).json({ success: false, message: 'Agency not found.' });
      return;
    }
    await logActivity({
      actorId: req.adminUser!.id,
      actorRole: req.adminUser!.role,
      actionType: 'reject_agency',
      targetEntityType: 'Agency',
      targetEntityId: id,
      description: `Rejected agency ${agency.name}. Reason: ${reason || 'N/A'}`,
    });
    res.status(200).json({ success: true, agency });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Block / Unblock Agency ───────────────────────────────────────────────────

export const blockAgency = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const agency = await Agency.findByIdAndUpdate(id, { status: 'blocked', isActive: false }, { new: true });
    if (!agency) {
      res.status(404).json({ success: false, message: 'Agency not found.' });
      return;
    }
    // Block the owner login
    await User.findByIdAndUpdate(agency.ownerId, { isBlocked: true, blockType: 'permanent' });

    await logActivity({
      actorId: req.adminUser!.id,
      actorRole: req.adminUser!.role,
      actionType: 'block_agency',
      targetEntityType: 'Agency',
      targetEntityId: id,
      description: `Blocked agency ${agency.name}`,
    });
    res.status(200).json({ success: true, agency });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const unblockAgency = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const agency = await Agency.findByIdAndUpdate(id, { status: 'active', isActive: true }, { new: true });
    if (!agency) {
      res.status(404).json({ success: false, message: 'Agency not found.' });
      return;
    }
    await User.findByIdAndUpdate(agency.ownerId, {
      isBlocked: false,
      $unset: { blockedUntil: 1, blockType: 1 },
    });

    await logActivity({
      actorId: req.adminUser!.id,
      actorRole: req.adminUser!.role,
      actionType: 'unblock_agency',
      targetEntityType: 'Agency',
      targetEntityId: id,
      description: `Unblocked agency ${agency.name}`,
    });
    res.status(200).json({ success: true, agency });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Transfer Hosts ───────────────────────────────────────────────────────────

export const transferHosts = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { id: sourceAgencyId } = req.params;
    const { hostIds, targetAgencyId, transferAll } = req.body;

    if (!targetAgencyId) {
      res.status(400).json({ success: false, message: 'targetAgencyId is required.' });
      return;
    }

    const targetAgency = await Agency.findById(targetAgencyId);
    if (!targetAgency) {
      res.status(404).json({ success: false, message: 'Target agency not found.' });
      return;
    }

    const query = transferAll
      ? { agencyId: sourceAgencyId }
      : { agencyId: sourceAgencyId, _id: { $in: hostIds } };

    const result = await User.updateMany(query, { agencyId: targetAgencyId });

    // Update streamerIds on both agencies
    const movedHosts = await User.find({ agencyId: targetAgencyId }).select('_id').lean();
    await Agency.findByIdAndUpdate(targetAgencyId, {
      $addToSet: { streamerIds: { $each: movedHosts.map(h => h._id.toString()) } },
    });
    if (transferAll) {
      await Agency.findByIdAndUpdate(sourceAgencyId, { streamerIds: [] });
    }

    await logActivity({
      actorId: req.adminUser!.id,
      actorRole: req.adminUser!.role,
      actionType: 'transfer_hosts',
      targetEntityType: 'Agency',
      targetEntityId: sourceAgencyId,
      description: `Transferred ${result.modifiedCount} host(s) from agency ${sourceAgencyId} to ${targetAgency.name}`,
    });

    res.status(200).json({ success: true, transferred: result.modifiedCount });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Terminate Agency ─────────────────────────────────────────────────────────

export const terminateAgency = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const agency = await Agency.findByIdAndUpdate(
      id,
      { status: 'terminated', isActive: false },
      { new: true }
    );
    if (!agency) {
      res.status(404).json({ success: false, message: 'Agency not found.' });
      return;
    }

    // Terminate owner login
    await User.findByIdAndUpdate(agency.ownerId, { isTerminated: true });

    await logActivity({
      actorId: req.adminUser!.id,
      actorRole: req.adminUser!.role,
      actionType: 'terminate_agency',
      targetEntityType: 'Agency',
      targetEntityId: id,
      description: `Terminated agency ${agency.name}`,
    });

    res.status(200).json({ success: true, agency });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Send Termination Reason (Super Admin only) ───────────────────────────────

export const sendTerminationReason = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      res.status(400).json({ success: false, message: 'Reason is required.' });
      return;
    }

    const agency = await Agency.findById(id).lean();
    if (!agency) {
      res.status(404).json({ success: false, message: 'Agency not found.' });
      return;
    }

    // Log to activity log — Company Admin will see this
    await logActivity({
      actorId: req.adminUser!.id,
      actorRole: 'super_admin',
      actionType: 'termination_reason_sent',
      targetEntityType: 'Agency',
      targetEntityId: id,
      description: `Super Admin sent termination reason for agency ${agency.name}: ${reason}`,
      metadata: { reason },
    });

    res.status(200).json({ success: true, message: 'Termination reason sent to Company Admin.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
