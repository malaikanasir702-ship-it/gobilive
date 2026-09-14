import { Response } from 'express';
import { Types } from 'mongoose';
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
    const id = String(req.params.id);
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
    const id = String(req.params.id);
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
    const id = String(req.params.id);
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
    const id = String(req.params.id);
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
    const id = String(req.params.id);
    const user = await User.findById(id).select('-passwordHash').lean();
    if (!user) {
      res.status(404).json({ success: false, message: 'Sub admin not found.' });
      return;
    }
    const agencies = await Agency.find({ subAdminId: id } as any).limit(50).lean();
    res.status(200).json({ success: true, user, agencies });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Sub Admin: Create Agency ──────────────────────────────────────────────────
// POST /sub-admins/my-agencies
// Accessible by sub_admin (creates agency under themselves) OR
// by super_admin/company_admin creating an agency for a specific sub admin.
export const createAgencyBySubAdmin = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { name, agencyCode: providedCode, sharePercent, target, countryCode } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ success: false, message: 'Agency name is required.' });
      return;
    }

    // Determine which sub_admin owns this agency
    // If called by sub_admin themselves → use their own id
    // If called by super_admin/company_admin → use subAdminId from body
    let subAdminId: string;
    let subAdminUser: any;

    if (req.adminUser!.role === 'sub_admin') {
      subAdminId = req.adminUser!.id;
      subAdminUser = await User.findById(subAdminId).select('username').lean();
    } else {
      // super_admin or company_admin specifying a sub admin
      const { subAdminId: bodySubAdminId } = req.body;
      if (!bodySubAdminId || !Types.ObjectId.isValid(bodySubAdminId)) {
        res.status(400).json({ success: false, message: 'subAdminId is required when called by super/company admin.' });
        return;
      }
      subAdminId = String(bodySubAdminId);
      subAdminUser = await User.findById(subAdminId).select('username role').lean();
      if (!subAdminUser || (subAdminUser as any).role !== 'sub_admin') {
        res.status(404).json({ success: false, message: 'Sub admin not found.' });
        return;
      }
    }

    if (!subAdminUser) {
      res.status(404).json({ success: false, message: 'Sub admin user not found.' });
      return;
    }

    // Auto-generate agencyCode if not provided
    const agencyCode = (providedCode && String(providedCode).trim())
      ? String(providedCode).trim().toUpperCase()
      : `AGC${Date.now().toString().slice(-6)}`;

    // Check agencyCode uniqueness
    const codeExists = await Agency.findOne({ agencyCode }).select('_id').lean();
    if (codeExists) {
      res.status(409).json({ success: false, message: `Agency code "${agencyCode}" is already taken. Please choose a different one.` });
      return;
    }

    const agency = await Agency.create({
      name: name.trim(),
      ownerId: subAdminId,
      ownerUsername: (subAdminUser as any).username,
      agencyCode,
      status: 'active',
      isActive: true,
      subAdminId: subAdminId as any,
      sharePercent: sharePercent ? Number(sharePercent) : 3,
      target: target ? Number(target) : 0,
      countryCode: countryCode ? String(countryCode).toUpperCase() : '',
    } as any);

    await logActivity({
      actorId: req.adminUser!.id,
      actorRole: req.adminUser!.role,
      actionType: 'create_agency',
      targetEntityType: 'Agency',
      targetEntityId: String((agency as any)._id),
      description: `Sub admin ${(subAdminUser as any).username} created agency "${(agency as any).name}" (${(agency as any).agencyCode})`,
      metadata: { subAdminId },
    });

    res.status(201).json({ success: true, agency });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Sub Admin: List Own Agencies ──────────────────────────────────────────────
// GET /sub-admins/my-agencies
export const listMyAgenciesForSubAdmin = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const subAdminId = req.adminUser!.id;
    const page  = Math.max(1, parseInt((req.query.page as string)  || '1',  10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));

    const filter: any = { subAdminId: new Types.ObjectId(subAdminId) };
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
