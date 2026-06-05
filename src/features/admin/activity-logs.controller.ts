import { Request, Response } from 'express';
import { ActivityLog } from '../activity-log/activity-log.model';
import { Types } from 'mongoose';

export async function listActivityLogs(req: Request, res: Response) {
  try {
    const { actorId, actorRole, actionType, targetEntityType, page = 1, limit = 50, from, to } = req.query as any;
    const filter: any = {};
    if (actorId && Types.ObjectId.isValid(actorId)) filter.actorId = new Types.ObjectId(actorId);
    if (actorRole) filter.actorRole = actorRole;
    if (actionType) filter.actionType = actionType;
    if (targetEntityType) filter.targetEntityType = targetEntityType;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const total = await ActivityLog.countDocuments(filter);
    const data = await ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    res.json({ success: true, data, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getActivityLog(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const doc = await ActivityLog.findById(id).lean();
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: doc });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function exportActivityLogs(req: Request, res: Response) {
  try {
    const { actorRole, actionType, from, to } = req.query as any;
    const filter: any = {};
    if (actorRole) filter.actorRole = actorRole;
    if (actionType) filter.actionType = actionType;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const docs = await ActivityLog.find(filter).sort({ createdAt: -1 }).limit(10000).lean();

    if (!docs.length) {
      res.setHeader('Content-Type', 'text/csv');
      res.send('createdAt,actorId,actorRole,actionType,targetEntityType,targetEntityId,description\n');
      return;
    }

    const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
    const header = 'createdAt,actorId,actorRole,actionType,targetEntityType,targetEntityId,description,metadata\n';
    const body = docs.map(d => [
      d.createdAt.toISOString(),
      d.actorId?.toString(),
      d.actorRole,
      d.actionType,
      d.targetEntityType,
      d.targetEntityId,
      d.description,
      JSON.stringify(d.metadata || {}),
    ].map(escape).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="activity_logs_${Date.now()}.csv"`);
    res.send(header + body);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export default {};
