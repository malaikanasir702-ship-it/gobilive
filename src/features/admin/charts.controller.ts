import { Response } from 'express';
import { AdminAuthRequest } from '../../core/middlewares/rbac.middleware';
import { User } from '../auth/user.model';
import { BeanTransaction } from '../beans/bean-transaction.model';
import WalletTransaction from '../wallet/wallet.transaction.model';
import LiveRoom from '../live/live.model';

type Range = '7d' | '30d' | '90d';

function getDaysArray(range: Range): Date[] {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const result: Date[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    result.push(d);
  }
  return result;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * GET /api/admin-panel/v1/dashboard/charts?range=7d|30d|90d
 * Returns time-series data for charts in Company Admin Dashboard.
 */
export const getCharts = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const range = ((req.query.range as string) || '7d') as Range;
    if (!['7d', '30d', '90d'].includes(range)) {
      res.status(400).json({ success: false, message: 'range must be 7d, 30d, or 90d.' });
      return;
    }

    const days = getDaysArray(range);
    const startDate = days[0];
    const endDate = new Date();

    // ── Parallel data fetch ────────────────────────────────────────────────
    const [newUsers, beanTxs, walletTxs, liveRooms] = await Promise.all([
      // New users grouped by day
      User.aggregate([
        { $match: { role: 'user', createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Bean transactions grouped by day and type
      BeanTransaction.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
            type: { $in: ['assign', 'generate', 'transfer'] },
            status: 'completed',
          },
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              type: '$type',
            },
            total: { $sum: '$amount' },
          },
        },
        { $sort: { '_id.date': 1 } },
      ]),

      // Wallet transactions grouped by day
      WalletTransaction.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
            status: 'succeeded',
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            revenue: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Live streams per day
      LiveRoom.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // ── Map to date-indexed dictionaries ──────────────────────────────────
    const userMap: Record<string, number> = {};
    newUsers.forEach(u => { userMap[u._id] = u.count; });

    const beanAssignMap: Record<string, number> = {};
    const beanGenerateMap: Record<string, number> = {};
    const beanTransferMap: Record<string, number> = {};
    beanTxs.forEach(b => {
      const date = b._id.date;
      if (b._id.type === 'assign')    beanAssignMap[date]    = (beanAssignMap[date]    || 0) + b.total;
      if (b._id.type === 'generate')  beanGenerateMap[date]  = (beanGenerateMap[date]  || 0) + b.total;
      if (b._id.type === 'transfer')  beanTransferMap[date]  = (beanTransferMap[date]  || 0) + b.total;
    });

    const revenueMap: Record<string, { revenue: number; count: number }> = {};
    walletTxs.forEach(w => { revenueMap[w._id] = { revenue: w.revenue, count: w.count }; });

    const streamMap: Record<string, number> = {};
    liveRooms.forEach(l => { streamMap[l._id] = l.count; });

    // ── Build unified per-day arrays ──────────────────────────────────────
    const userGrowth = days.map(d => ({
      date: formatDate(d),
      newUsers: userMap[formatDate(d)] ?? 0,
    }));

    const beanFlow = days.map(d => ({
      date: formatDate(d),
      assigned:  beanAssignMap[formatDate(d)]   ?? 0,
      generated: beanGenerateMap[formatDate(d)] ?? 0,
      transferred: beanTransferMap[formatDate(d)] ?? 0,
    }));

    const revenueByDay = days.map(d => ({
      date: formatDate(d),
      revenue: revenueMap[formatDate(d)]?.revenue ?? 0,
      transactions: revenueMap[formatDate(d)]?.count ?? 0,
    }));

    const streamsByDay = days.map(d => ({
      date: formatDate(d),
      streams: streamMap[formatDate(d)] ?? 0,
    }));

    res.json({
      success: true,
      range,
      userGrowth,
      beanFlow,
      revenueByDay,
      streamsByDay,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
