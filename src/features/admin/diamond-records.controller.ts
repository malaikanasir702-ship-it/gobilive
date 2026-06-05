import { Request, Response } from 'express';
import WalletTransaction from '../wallet/wallet.transaction.model';

export async function listDiamondRecords(req: Request, res: Response) {
  const { userId, type, page = 1, limit = 50, from, to } = req.query as any;
  const filter: any = { currency: 'diamonds' };
  if (userId) filter.userId = userId;
  if (type) filter.type = type;
  if (from || to) filter.createdAt = {};
  if (from) filter.createdAt.$gte = new Date(from);
  if (to) filter.createdAt.$lte = new Date(to);

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
