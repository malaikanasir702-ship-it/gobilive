import { Request, Response } from 'express';
import { PolicyLog } from '../policy/policy-log.model';
import { logActivity } from '../activity-log/activity-log.service';

export async function listPolicyLogs(req: Request, res: Response) {
  try {
    const { policyName, page = 1, limit = 20, countryCode } = req.query as any;
    const filter: any = {};
    if (policyName) filter.policyName = policyName;
    if (countryCode) filter.countryCode = countryCode;

    const total = await PolicyLog.countDocuments(filter);
    const data = await PolicyLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .populate('changedBy', 'username')
      .lean();

    res.json({ success: true, data, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getPolicyLog(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const doc = await PolicyLog.findById(id).lean();
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: doc });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function createPolicyLog(req: Request, res: Response) {
  try {
    const { policyName, previousValue, newValue, countryCode } = req.body as any;
    const changedBy = (req as any).adminUser?.id;
    const changedByRole = (req as any).adminUser?.role || 'company_admin';

    if (!policyName || newValue === undefined) {
      return res.status(400).json({ success: false, message: 'policyName and newValue required' });
    }

    const doc = await PolicyLog.create({ policyName, previousValue, newValue, changedBy, countryCode });

    await logActivity({
      actorId: changedBy, actorRole: changedByRole,
      actionType: 'update_policy', targetEntityType: 'PolicyLog', targetEntityId: doc._id.toString(),
      description: `Updated policy "${policyName}" to ${JSON.stringify(newValue)}`,
    });

    res.status(201).json({ success: true, data: doc });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export default {};
