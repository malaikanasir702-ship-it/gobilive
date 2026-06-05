import { Response } from 'express';
import { User } from '../auth/user.model';
import LiveRoom from '../live/live.model';
import StreamReport from '../live/report.model';
import WalletTransaction from '../wallet/wallet.transaction.model';
import { Agency } from '../agency/agency.model';
import { NotificationTriggers, sendToUser } from '../notifications/notification.service';
import { CoinSeller } from '../coin-seller/coin-seller.model';
import AgencyPayout from '../agency/agency-payout.model';
import { PlatformSettings, getPlatformSettings } from '../settings/platform-settings.model';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { DIAMOND_PACKAGES, VIP_PLANS } from '../wallet/wallet.config';
import { GIFT_CATALOG } from '../gifts/gift.config';
import { Post } from '../feed/post.model';

export const getDashboard = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

    const [userCount, activeStreams, pendingWithdrawals, agencies, coinSellers, newUsers7d, activeUsers30d, pendingRegs, openSupportChats] = await Promise.all([
      User.countDocuments(),
      LiveRoom.countDocuments({ isActive: true }),
      WalletTransaction.countDocuments({ type: 'withdraw_rcoins', status: 'pending' }),
      Agency.countDocuments({ isActive: true }),
      CoinSeller.countDocuments({ isApproved: true }),
      User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      WalletTransaction.distinct('userId', { createdAt: { $gte: thirtyDaysAgo } }).then((a) => a.length),
      (await import('../registration/registration-request.model')).RegistrationRequest.countDocuments({ status: 'pending' }),
      (await import('../support/support-chat.model')).SupportChat.countDocuments({ closedAt: { $exists: false } }),
    ]);

    const recentTx = await WalletTransaction.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('userId', 'username')
      .lean();

    // diamonds spent / purchased in last 30 days
    const diamondsAgg = await WalletTransaction.aggregate([
      { $match: { currency: 'diamonds', createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: null,
          purchased: { $sum: { $cond: [{ $eq: ['$type', 'purchase_diamonds'] }, '$amount', 0] } },
          spent: { $sum: { $cond: [{ $lt: ['$diamondsDelta', 0] }, { $abs: '$diamondsDelta' }, 0] } },
        },
      },
    ]);

    const diamondsSummary = (diamondsAgg && diamondsAgg[0]) || { purchased: 0, spent: 0 };

    res.status(200).json({
      success: true,
      stats: {
        userCount,
        newUsers7d,
        activeUsers30d,
        activeStreams,
        pendingWithdrawals,
        pendingRegistrations: pendingRegs,
        openSupportChats,
        agencies,
        coinSellers,
      },
      diamondsSummary,
      recentTransactions: recentTx,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const listUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 50;
    const users = await User.find()
      .select('-passwordHash -fcmTokens')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.status(200).json({ success: true, users });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const adjustUserWallet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, diamonds, rcoins, reason } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    const diamondsDelta = diamonds ?? 0;
    const rcoinsDelta = rcoins ?? 0;
    user.diamonds += diamondsDelta;
    user.rcoins += rcoinsDelta;
    await user.save();

    await WalletTransaction.create({
      userId: user._id,
      type: 'admin_adjust',
      currency: diamondsDelta ? 'diamonds' : 'rcoins',
      amount: Math.abs(diamondsDelta || rcoinsDelta),
      diamondsDelta,
      rcoinsDelta,
      diamondsBalance: user.diamonds,
      rcoinsBalance: user.rcoins,
      status: 'completed',
      description: reason || 'Admin adjustment',
    });

    res.status(200).json({ success: true, user: { diamonds: user.diamonds, rcoins: user.rcoins } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSettings = async (_req: AuthRequest, res: Response): Promise<void> => {
  const settings = await getPlatformSettings();
  res.status(200).json({
    success: true,
    settings,
    diamondPackages: DIAMOND_PACKAGES,
    vipPlans: VIP_PLANS,
    giftCatalog: GIFT_CATALOG,
  });
};

export const updateSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const settings = await getPlatformSettings();
    Object.assign(settings, req.body);
    await settings.save();
    res.status(200).json({ success: true, settings });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const listAgencies = async (_req: AuthRequest, res: Response): Promise<void> => {
  const agencies = await Agency.find().sort({ createdAt: -1 }).lean();
  res.status(200).json({ success: true, agencies });
};

export const listCoinSellers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '12', 10)));
    const q = (req.query.q as string) || '';

    const filter: any = {};
    if (q && q.trim().length > 0) {
      const re = new RegExp(q.trim(), 'i');
      filter.$or = [{ username: re }, { businessName: re }];
    }

    const total = await CoinSeller.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const sellers = await CoinSeller.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.status(200).json({ success: true, sellers, total, page, totalPages, limit });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const listAgencyPayouts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '12', 10)));
    const q = (req.query.q as string) || '';

    const filter: any = {};
    if (q && q.trim().length > 0) {
      const re = new RegExp(q.trim(), 'i');
      filter.$or = [{ agencyName: re }, { method: re }];
      // allow numeric search on amount
      if (!isNaN(Number(q))) filter.$or.push({ amount: Number(q) });
    }

    const total = await AgencyPayout.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const payouts = await AgencyPayout.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.status(200).json({ success: true, payouts, total, page, totalPages, limit });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const processAgencyPayout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { payoutId, status } = req.body;
    const payout = await AgencyPayout.findByIdAndUpdate(payoutId, { status }, { new: true });
    res.status(200).json({ success: true, payout });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const approveCoinSeller = async (req: AuthRequest, res: Response): Promise<void> => {
  const seller = await CoinSeller.findByIdAndUpdate(
    req.params.id,
    { isApproved: true },
    { new: true }
  );
  if (seller) {
    await User.findByIdAndUpdate(seller.userId, { role: 'coin_seller' });
  }
  res.status(200).json({ success: true, seller });
};

export const rejectCoinSeller = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const seller = await CoinSeller.findByIdAndUpdate(req.params.id, { isApproved: false }, { new: true });
    if (seller) {
      await User.findByIdAndUpdate(seller.userId, { role: 'user' });
    }
    res.status(200).json({ success: true, seller });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const listActiveStreams = async (_req: AuthRequest, res: Response): Promise<void> => {
  const streams = await LiveRoom.find({ isActive: true }).sort({ createdAt: -1 }).lean();
  res.status(200).json({ success: true, streams });
};

export const endStreamAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  const room = await LiveRoom.findOneAndUpdate(
    { channelName: req.params.channelName },
    { isActive: false },
    { new: true }
  );
  res.status(200).json({ success: true, room });
};

export const listPosts = async (_req: AuthRequest, res: Response): Promise<void> => {
  const posts = await Post.find().sort({ createdAt: -1 }).limit(100).lean();
  res.status(200).json({ success: true, posts });
};

export const listPendingWithdrawals = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const withdrawals = await WalletTransaction.find({ type: 'withdraw_rcoins', status: 'pending' })
      .sort({ createdAt: -1 })
      .populate('userId', 'username')
      .lean();
    res.status(200).json({ success: true, withdrawals });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const listWithdrawals = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const status = (req.query.status as string | undefined)?.toLowerCase();
    const query: any = { type: 'withdraw_rcoins' };
    if (status && status !== 'all') {
      query.status = status;
    }

    const withdrawals = await WalletTransaction.find(query)
      .sort({ createdAt: -1 })
      .populate('userId', 'username')
      .lean();

    res.status(200).json({ success: true, withdrawals });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const processWithdrawal = async (req: AuthRequest, res: Response): Promise<void> => {
  const { txId, status } = req.body;
  const tx = await WalletTransaction.findByIdAndUpdate(txId, { status }, { new: true }).lean();
  if (!tx) {
    res.status(404).json({ success: false, message: 'Withdrawal not found.' });
    return;
  }
  if (status === 'completed' && tx.userId) {
    await sendToUser(tx.userId.toString(), NotificationTriggers.withdrawalSubmitted(tx.amount));
  }
  if (status === 'failed' && tx.userId) {
    await sendToUser(tx.userId.toString(), {
      title: 'Withdrawal Failed',
      body: 'Your withdrawal request could not be processed. Please contact support.',
      data: { type: 'withdrawal_failed' },
    });
  }
  res.status(200).json({ success: true, transaction: tx });
};

export const listStreamReports = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const reports = await StreamReport.find().sort({ createdAt: -1 }).limit(200).lean();
    res.status(200).json({ success: true, reports });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const suspendUserAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { suspend } = req.body; // boolean
    const user = await User.findByIdAndUpdate(id, { isSuspended: Boolean(suspend) }, { new: true });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }
    // If suspending, also forcibly end their active stream
    if (suspend) {
      await LiveRoom.updateMany({ hostId: id, isActive: true }, { isActive: false });
    }
    res.status(200).json({ success: true, isSuspended: user.isSuspended });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const suspendUserByUsername = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { username, suspend } = req.body;
    const user = await User.findOneAndUpdate(
      { username },
      { isSuspended: Boolean(suspend) },
      { new: true }
    );
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }
    if (suspend) {
      await LiveRoom.updateMany({ hostUsername: username, isActive: true }, { isActive: false });
    }
    res.status(200).json({ success: true, isSuspended: user.isSuspended });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
