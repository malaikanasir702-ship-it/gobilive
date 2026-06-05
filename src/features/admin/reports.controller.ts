import { Request, Response } from 'express';
import StreamReport from '../live/report.model';
import { User } from '../auth/user.model';
import LiveRoom from '../live/live.model';
import { logActivity } from '../activity-log/activity-log.service';
import { sendToUser } from '../notifications/notification.service';

export async function listReports(req: Request, res: Response) {
  try {
    const { hostUsername, reporterUsername, page = 1, limit = 20, from, to } = req.query as any;
    const filter: any = {};
    if (hostUsername) filter.hostUsername = new RegExp(hostUsername, 'i');
    if (reporterUsername) filter.reporterUsername = new RegExp(reporterUsername, 'i');
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const total = await StreamReport.countDocuments(filter);
    const data = await StreamReport.find(filter)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    res.json({ success: true, data, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getReport(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const rpt = await StreamReport.findById(id).lean();
    if (!rpt) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: rpt });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function dismissReport(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const adminId = (req as any).adminUser?.id || 'system';
    const adminRole = (req as any).adminUser?.role || 'company_admin';

    const rpt = await StreamReport.findByIdAndDelete(id).lean();
    if (!rpt) return res.status(404).json({ success: false, message: 'Not found' });

    await logActivity({
      actorId: adminId, actorRole: adminRole,
      actionType: 'dismiss_report', targetEntityType: 'StreamReport', targetEntityId: id,
      description: `Dismissed report against host ${rpt.hostUsername}`,
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function escalateReport(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'suspend' | 'block' | 'terminate'
    const adminId = (req as any).adminUser?.id || 'system';
    const adminRole = (req as any).adminUser?.role || 'company_admin';

    const rpt = await StreamReport.findById(id);
    if (!rpt) return res.status(404).json({ success: false, message: 'Not found' });

    const host = await User.findOne({ username: rpt.hostUsername });
    if (!host) return res.status(404).json({ success: false, message: 'Host not found' });

    if (action === 'suspend') {
      host.isSuspended = true;
      await host.save();
      // End any active streams
      await LiveRoom.updateMany({ hostId: host._id, isActive: true }, { isActive: false });
      await sendToUser(host._id.toString(), {
        title: 'Account Suspended',
        body: 'Your account has been suspended due to a reported violation.',
        data: { type: 'account_suspended' },
      });
    } else if (action === 'block') {
      host.isBlocked = true;
      host.blockType = 'permanent';
      await host.save();
      await LiveRoom.updateMany({ hostId: host._id, isActive: true }, { isActive: false });
    } else if (action === 'terminate') {
      host.isTerminated = true;
      await host.save();
      await LiveRoom.updateMany({ hostId: host._id, isActive: true }, { isActive: false });
    }

    // Delete the report after action
    await StreamReport.findByIdAndDelete(id);

    await logActivity({
      actorId: adminId, actorRole: adminRole,
      actionType: 'escalate_report', targetEntityType: 'User', targetEntityId: host._id.toString(),
      description: `Escalated report against host ${rpt.hostUsername} with action: ${action}`,
    });

    res.json({ success: true, action, hostId: host._id });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export default {};
