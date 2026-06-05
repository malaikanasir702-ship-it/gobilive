import { Response } from 'express';
import { Types } from 'mongoose';
import { User } from '../../auth/user.model';
import { Agency } from '../../agency/agency.model';
import { logActivity } from '../../activity-log/activity-log.service';
import { AdminAuthRequest } from '../../../core/middlewares/rbac.middleware';

// List Super Admins
export const listSuperAdmins = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
    const filter: any = { role: 'super_admin' };
    const total = await User.countDocuments(filter);
    const items = await User.find(filter)
      .select('username email phone isBlocked isSuspended createdAt agencyId')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    res.status(200).json({ success: true, items, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Approve Super Admin (un-suspend / activate)
export const approveSuperAdmin = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndUpdate(id, { isSuspended: false, isTerminated: false }, { new: true }).select('username isSuspended isTerminated');
    if (!user) {
      res.status(404).json({ success: false, message: 'Super admin not found.' });
      return;
    }
    await logActivity({
      actorId: req.adminUser!.id,
      actorRole: req.adminUser!.role,
      actionType: 'approve_super_admin',
      targetEntityType: 'User',
      targetEntityId: id,
      description: `Approved super admin ${user.username}`,
    });
    res.status(200).json({ success: true, user });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const rejectSuperAdmin = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const user = await User.findByIdAndUpdate(id, { isTerminated: true }, { new: true }).select('username isTerminated');
    if (!user) {
      res.status(404).json({ success: false, message: 'Super admin not found.' });
      return;
    }
    await logActivity({
      actorId: req.adminUser!.id,
      actorRole: req.adminUser!.role,
      actionType: 'reject_super_admin',
      targetEntityType: 'User',
      targetEntityId: id,
      description: `Rejected super admin ${user.username}. Reason: ${reason || 'N/A'}`,
    });
    res.status(200).json({ success: true, user });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const blockSuperAdmin = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { type, durationHours } = req.body;
    const update: any = { isBlocked: true };
    if (type === 'temporary' && durationHours) {
      update.blockedUntil = new Date(Date.now() + Number(durationHours) * 60 * 60 * 1000);
      update.blockType = 'temporary';
    } else if (type === 'permanent') {
      update.blockType = 'permanent';
      update.$unset = { blockedUntil: 1 };
    }
    const user = await User.findByIdAndUpdate(id, update, { new: true }).select('username isBlocked blockedUntil blockType');
    if (!user) {
      res.status(404).json({ success: false, message: 'Super admin not found.' });
      return;
    }
    await logActivity({
      actorId: req.adminUser!.id,
      actorRole: req.adminUser!.role,
      actionType: 'block_super_admin',
      targetEntityType: 'User',
      targetEntityId: id,
      description: `Blocked super admin ${user.username} (${update.blockType})`,
    });
    res.status(200).json({ success: true, user });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const unblockSuperAdmin = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndUpdate(id, { isBlocked: false, $unset: { blockedUntil: 1, blockType: 1 } }, { new: true }).select('username isBlocked');
    if (!user) {
      res.status(404).json({ success: false, message: 'Super admin not found.' });
      return;
    }
    await logActivity({
      actorId: req.adminUser!.id,
      actorRole: req.adminUser!.role,
      actionType: 'unblock_super_admin',
      targetEntityType: 'User',
      targetEntityId: id,
      description: `Unblocked super admin ${user.username}`,
    });
    res.status(200).json({ success: true, user });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Fire super admin: set terminated and optionally transfer agencies
export const fireSuperAdmin = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { transferToSuperAdminId } = req.body;
    const user = await User.findByIdAndUpdate(id, { isTerminated: true }, { new: true }).select('username isTerminated');
    if (!user) {
      res.status(404).json({ success: false, message: 'Super admin not found.' });
      return;
    }
    if (transferToSuperAdminId) {
      await Agency.updateMany({ superAdminId: id }, { superAdminId: transferToSuperAdminId });
    }
    await logActivity({
      actorId: req.adminUser!.id,
      actorRole: req.adminUser!.role,
      actionType: 'fire_super_admin',
      targetEntityType: 'User',
      targetEntityId: id,
      description: `Fired super admin ${user.username}`,
    });
    res.status(200).json({ success: true, user });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const transferAgencies = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { fromSuperAdminId } = req.params;
    const { toSuperAdminId, agencyIds } = req.body;
    if (!toSuperAdminId) {
      res.status(400).json({ success: false, message: 'toSuperAdminId is required.' });
      return;
    }
    if (!Array.isArray(agencyIds) || agencyIds.length === 0) {
      res.status(400).json({ success: false, message: 'agencyIds array is required.' });
      return;
    }
    const ids = agencyIds.map((a: string) => new Types.ObjectId(a));
    const result = await Agency.updateMany({ _id: { $in: ids }, superAdminId: fromSuperAdminId }, { superAdminId: toSuperAdminId });
    await logActivity({
      actorId: req.adminUser!.id,
      actorRole: req.adminUser!.role,
      actionType: 'transfer_agencies',
      targetEntityType: 'Agency',
      targetEntityId: fromSuperAdminId,
      description: `Transferred ${ids.length} agencies from ${fromSuperAdminId} to ${toSuperAdminId}`,
      metadata: { result },
    });
    res.status(200).json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
