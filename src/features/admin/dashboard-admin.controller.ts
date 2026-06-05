import { Response } from 'express';
import { Types } from 'mongoose';
import { User } from '../auth/user.model';
import { Agency } from '../agency/agency.model';
import { WithdrawalRequest } from '../withdrawal/withdrawal-request.model';
import { BeanTransaction } from '../beans/bean-transaction.model';
import WalletTransaction from '../wallet/wallet.transaction.model';
import { RegistrationRequest } from '../registration/registration-request.model';
import { SupportChat } from '../support/support-chat.model';
import { AdminAuthRequest } from '../../core/middlewares/rbac.middleware';

// ── Shared helper: top 10 agencies ────────────────────────────────────────

async function getTop10() {
  const agencies = await Agency.find({ status: 'active', target: { $gt: 0 } })
    .sort({ targetAchieved: -1 })
    .limit(10)
    .select('name agencyCode target targetAchieved sharePercent countryCode ownerUsername')
    .lean();
  return agencies.map(a => ({
    ...a,
    achievementPercent: a.target > 0 ? Math.round((a.targetAchieved / a.target) * 100) : 0,
  }));
}

// ── Company Admin Dashboard ───────────────────────────────────────────────

async function companyAdminDashboard(res: Response) {
  const [
    totalUsers, blockedUsers, blockedHosts,
    totalAgencies, activeAgencies,
    totalSuperAdmins, totalSubAdmins,
    totalTopUps, totalResellers,
    pendingRegistrations,
    openSupportChats,
    beanWallet,
    top10,
  ] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    User.countDocuments({ isBlocked: true }),
    User.countDocuments({ agencyId: { $exists: true, $ne: null }, isBlocked: true }),
    Agency.countDocuments(),
    Agency.countDocuments({ status: 'active' }),
    User.countDocuments({ role: 'super_admin' }),
    User.countDocuments({ role: 'sub_admin' }),
    User.countDocuments({ role: 'top_up_agent' }),
    User.countDocuments({ role: 'reseller' }),
    RegistrationRequest.countDocuments({ status: 'pending' }),
    SupportChat.countDocuments(),
    User.findOne({ role: 'company_admin' }).select('beanWallet').lean(),
    getTop10(),
  ]);

  // Recent transactions summary
  const recentTx = await WalletTransaction.find()
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('userId', 'username')
    .lean();

  // Agencies table (first 20)
  const agencies = await Agency.find()
    .sort({ targetAchieved: -1 })
    .limit(20)
    .select('name agencyCode target targetAchieved sharePercent status')
    .lean();

  // Super admins summary
  const superAdmins = await User.find({ role: 'super_admin' })
    .select('username email phone isBlocked beanWallet diamonds createdAt')
    .limit(10)
    .lean();

  // Sub admins summary
  const subAdmins = await User.find({ role: 'sub_admin' })
    .select('username email phone isBlocked beanWallet diamonds createdAt')
    .limit(10)
    .lean();

  // Top ups with sales
  const topUpAgents = await User.find({ role: 'top_up_agent' })
    .select('username email beanWallet isBlocked createdAt')
    .limit(10)
    .lean();

  // Resellers with beans
  const resellers = await User.find({ role: 'reseller' })
    .select('username email beanWallet isBlocked parentId createdAt')
    .limit(10)
    .lean();

  res.json({
    success: true,
    role: 'company_admin',
    stats: {
      totalUsers, blockedUsers, blockedHosts,
      totalAgencies, activeAgencies,
      totalSuperAdmins, totalSubAdmins,
      totalTopUps, totalResellers,
      pendingRegistrations,
      openSupportChats,
      beanWallet: beanWallet?.beanWallet ?? 0,
    },
    top10Agencies: top10,
    agencies,
    superAdmins,
    subAdmins,
    topUpAgents,
    resellers,
    recentTransactions: recentTx,
  });
}

// ── Super Admin Dashboard ─────────────────────────────────────────────────

async function superAdminDashboard(adminId: string, res: Response) {
  const [
    subAdmins, agencies, resellers, withdrawals, admin, top10,
  ] = await Promise.all([
    User.find({ role: 'sub_admin' })
      .select('username email phone sharePercent beanWallet diamonds isBlocked createdAt')
      .limit(20)
      .lean(),
    Agency.find({ superAdminId: new Types.ObjectId(adminId) } as any)
      .select('name agencyCode target targetAchieved sharePercent status streamerIds')
      .limit(20)
      .lean(),
    User.find({ role: 'reseller' })
      .select('username email beanWallet sharePercent diamonds isBlocked createdAt')
      .limit(20)
      .lean(),
    WithdrawalRequest.find({ superAdminId: adminId })
      .sort({ requestedAt: -1 })
      .limit(20)
      .lean(),
    User.findById(adminId).select('sharePercent beanWallet diamonds').lean(),
    getTop10(),
  ]);

  const pendingWithdrawals = await WithdrawalRequest.countDocuments({ superAdminId: adminId, status: 'pending' });
  const pendingRegistrations = await RegistrationRequest.countDocuments({ status: 'pending' });

  res.json({
    success: true,
    role: 'super_admin',
    stats: {
      sharePercent: admin?.sharePercent ?? 0,
      beanWallet: admin?.beanWallet ?? 0,
      diamonds: admin?.diamonds ?? 0,
      pendingWithdrawals,
      pendingRegistrations,
    },
    subAdmins,
    agencies,
    resellers,
    withdrawals,
    top10Agencies: top10,
  });
}

// ── Sub Admin Dashboard ───────────────────────────────────────────────────

async function subAdminDashboard(adminId: string, res: Response) {
  const [agencies, withdrawals, admin, top10] = await Promise.all([
    Agency.find({ subAdminId: new Types.ObjectId(adminId) } as any)
      .select('name agencyCode target targetAchieved sharePercent status streamerIds')
      .limit(20)
      .lean(),
    WithdrawalRequest.find({ superAdminId: adminId })
      .sort({ requestedAt: -1 })
      .limit(20)
      .lean(),
    User.findById(adminId).select('sharePercent beanWallet diamonds').lean(),
    getTop10(),
  ]);

  const pendingWithdrawals = await WithdrawalRequest.countDocuments({ superAdminId: adminId, status: 'pending' });

  res.json({
    success: true,
    role: 'sub_admin',
    stats: {
      sharePercent: admin?.sharePercent ?? 0,
      beanWallet: admin?.beanWallet ?? 0,
      diamonds: admin?.diamonds ?? 0,
      pendingWithdrawals,
    },
    agencies,
    withdrawals,
    top10Agencies: top10,
  });
}

// ── Agency Dashboard ──────────────────────────────────────────────────────

async function agencyDashboard(adminId: string, res: Response) {
  const agency = await Agency.findOne({ ownerId: adminId }).lean();

  const [hosts, withdrawals, top10] = await Promise.all([
    User.find({ agencyId: agency?._id?.toString() ?? adminId })
      .select('username email phone diamonds rcoins beanWallet isBlocked isSuspended profilePic createdAt')
      .lean(),
    agency
      ? WithdrawalRequest.find({ agencyId: agency._id })
          .sort({ requestedAt: -1 })
          .limit(20)
          .lean()
      : [],
    getTop10(),
  ]);

  // Diamond totals per host
  const hostDiamondTotal = hosts.reduce((sum, h) => sum + (h.diamonds || 0), 0);

  res.json({
    success: true,
    role: 'agency',
    agency,
    stats: {
      totalHosts: hosts.length,
      hostDiamondTotal,
      target: agency?.target ?? 0,
      targetAchieved: agency?.targetAchieved ?? 0,
      sharePercent: agency?.sharePercent ?? 0,
    },
    hosts,
    withdrawals,
    top10Agencies: top10,
  });
}

// ── Top Up Agent Dashboard ────────────────────────────────────────────────

async function topUpAgentDashboard(adminId: string, res: Response) {
  const [agent, beanRequests, beanTransfers, resellers, top10] = await Promise.all([
    User.findById(adminId).select('beanWallet sharePercent username').lean(),
    BeanTransaction.find({ fromId: adminId, type: 'request' })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    BeanTransaction.find({ fromId: adminId, type: { $in: ['assign', 'transfer'] } })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    User.find({ role: 'reseller', parentId: new Types.ObjectId(adminId) } as any)
      .select('username email beanWallet isBlocked createdAt')
      .lean(),
    getTop10(),
  ]);

  res.json({
    success: true,
    role: 'top_up_agent',
    stats: {
      beanWallet: agent?.beanWallet ?? 0,
      sharePercent: agent?.sharePercent ?? 0,
      totalResellers: resellers.length,
    },
    recentBeanRequests: beanRequests,
    recentBeanTransfers: beanTransfers,
    resellers,
    top10Agencies: top10,
  });
}

// ── Reseller Dashboard ────────────────────────────────────────────────────

async function resellerDashboard(adminId: string, res: Response) {
  const [reseller, beanRequests, beanTransfers, top10] = await Promise.all([
    User.findById(adminId).select('beanWallet sharePercent username parentId').lean(),
    BeanTransaction.find({ fromId: adminId, type: 'request' })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    BeanTransaction.find({ fromId: adminId, type: { $in: ['assign', 'transfer'] } })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    getTop10(),
  ]);

  res.json({
    success: true,
    role: 'reseller',
    stats: {
      beanWallet: reseller?.beanWallet ?? 0,
      sharePercent: reseller?.sharePercent ?? 0,
    },
    recentBeanRequests: beanRequests,
    recentBeanTransfers: beanTransfers,
    top10Agencies: top10,
  });
}

// ── Main dispatcher ───────────────────────────────────────────────────────

export const getDashboard = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { id, role } = req.adminUser!;
    switch (role) {
      case 'company_admin':
        return await companyAdminDashboard(res);
      case 'super_admin':
        return await superAdminDashboard(id, res);
      case 'sub_admin':
        return await subAdminDashboard(id, res);
      case 'agency':
      case 'sub_agency':
        return await agencyDashboard(id, res);
      case 'top_up_agent':
        return await topUpAgentDashboard(id, res);
      case 'reseller':
        return await resellerDashboard(id, res);
      default:
        res.status(403).json({ success: false, message: 'No dashboard available for this role.' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
