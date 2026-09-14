import { Request, Response } from 'express';
import WalletTransaction from '../wallet/wallet.transaction.model';

export async function listDiamondRecords(req: Request, res: Response) {
  const { userId, type, page = 1, limit = 50, from, to } = req.query as any;
  const adminUser = (req as any).adminUser;
  const filter: any = { currency: 'diamonds' };
  if (userId) filter.userId = userId;
  if (type) filter.type = type;
  if (from || to) filter.createdAt = {};
  if (from) filter.createdAt.$gte = new Date(from);
  if (to) filter.createdAt.$lte = new Date(to);

  // super_admin / sub_admin: scope to their agencies' hosts
  if (adminUser?.role === 'super_admin' || adminUser?.role === 'sub_admin') {
    try {
      const { Agency } = await import('../agency/agency.model');
      const agencyQuery = adminUser.role === 'super_admin'
        ? { superAdminId: adminUser.id }
        : { subAdminId: adminUser.id };
      const myAgencies = await Agency.find(agencyQuery as any).select('_id agencyCode').lean();
      if (!myAgencies.length) {
        return res.json({ data: [], total: 0 });
      }
      const { User } = await import('../auth/user.model');
      const agencyRefs = (myAgencies as any[]).flatMap((a: any) => [String(a._id), ...(a.agencyCode ? [a.agencyCode] : [])]);
      const hosts = await User.find({ agencyId: { $in: agencyRefs } }).select('_id').lean();
      const hostIds = hosts.map((h: any) => String(h._id));
      if (!hostIds.length) return res.json({ data: [], total: 0 });
      filter.userId = { $in: hostIds };
    } catch (_) {}
  }

  const docs = await WalletTransaction.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));
  const total = await WalletTransaction.countDocuments(filter);
  res.json({ data: docs, total });
}

export async function getDiamondRecord(req: Request, res: Response) {
  const { id } = req.params;
  const doc = await WalletTransaction.findById(id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.json(doc);
}

export default {};
