import { Response } from 'express';
import { User } from '../auth/user.model';
import { Agency } from '../agency/agency.model';
import { logActivity } from '../activity-log/activity-log.service';
import { AdminAuthRequest } from '../../core/middlewares/rbac.middleware';

export const listSubAdmins = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
    const filter: any = { role: 'sub_admin' };
    const total = await User.countDocuments(filter);
    const items = await User.find(filter)
      .select('username email phone isBlocked isSuspended createdAt agencyId sharePercent')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    res.status(200).json({ success: true, items, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const approveSubAdmin = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndUpdate(id, { isSuspended: false }, { new: true }).select('username isSuspended');
    if (!user) {
      res.status(404).json({ success: false, message: 'Sub admin not found.' });
      return;
    }
    await logActivity({
      actorId: req.adminUser!.id,
      actorRole: req.adminUser!.role,
      actionType: 'approve_sub_admin',
      targetEntityType: 'User',
      targetEntityId: id,
      description: `Approved sub admin ${user.username}`,
    });
    res.status(200).json({ success: true, user });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const rejectSubAdmin = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const user = await User.findByIdAndUpdate(id, { isTerminated: true }, { new: true }).select('username isTerminated');
    if (!user) {
      res.status(404).json({ success: false, message: 'Sub admin not found.' });
      return;
    }
    await logActivity({
      actorId: req.adminUser!.id,
      actorRole: req.adminUser!.role,
      actionType: 'reject_sub_admin',
      targetEntityType: 'User',
      targetEntityId: id,
      description: `Rejected sub admin ${user.username}. Reason: ${reason || 'N/A'}`,
    });
    res.status(200).json({ success: true, user });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const blockSubAdmin = async (req: AdminAuthRequest, res: Response): Promise<void> => {
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
      res.status(404).json({ success: false, message: 'Sub admin not found.' });
      return;
    }
    await logActivity({
      actorId: req.adminUser!.id,
      actorRole: req.adminUser!.role,
      actionType: 'block_sub_admin',
      targetEntityType: 'User',
      targetEntityId: id,
      description: `Blocked sub admin ${user.username} (${update.blockType})`,
    });
    res.status(200).json({ success: true, user });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const unblockSubAdmin = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndUpdate(id, { isBlocked: false, $unset: { blockedUntil: 1, blockType: 1 } }, { new: true }).select('username isBlocked');
    if (!user) {
      res.status(404).json({ success: false, message: 'Sub admin not found.' });
      return;
    }
    await logActivity({
      actorId: req.adminUser!.id,
      actorRole: req.adminUser!.role,
      actionType: 'unblock_sub_admin',
      targetEntityType: 'User',
      targetEntityId: id,
      description: `Unblocked sub admin ${user.username}`,
    });
    res.status(200).json({ success: true, user });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getSubAdminDetail = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select('-passwordHash').lean();
    if (!user) {
      res.status(404).json({ success: false, message: 'Sub admin not found.' });
      return;
    }
    const agencies = await Agency.find({ subAdminId: id }).limit(50).lean();
    res.status(200).json({ success: true, user, agencies });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
