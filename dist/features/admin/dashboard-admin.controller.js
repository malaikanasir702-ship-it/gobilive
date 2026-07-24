"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboard = void 0;
const mongoose_1 = require("mongoose");
const user_model_1 = require("../auth/user.model");
const agency_model_1 = require("../agency/agency.model");
const withdrawal_request_model_1 = require("../withdrawal/withdrawal-request.model");
const bean_transaction_model_1 = require("../beans/bean-transaction.model");
const wallet_transaction_model_1 = __importDefault(require("../wallet/wallet.transaction.model"));
const registration_request_model_1 = require("../registration/registration-request.model");
const support_chat_model_1 = require("../support/support-chat.model");
// ── Shared helper: top 10 agencies ────────────────────────────────────────
async function getTop10() {
    const agencies = await agency_model_1.Agency.find({ status: 'active', target: { $gt: 0 } })
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
async function companyAdminDashboard(res) {
    const [totalUsers, blockedUsers, blockedHosts, totalAgencies, activeAgencies, totalSuperAdmins, totalSubAdmins, totalTopUps, totalResellers, pendingRegistrations, openSupportChats, beanWallet, top10,] = await Promise.all([
        user_model_1.User.countDocuments({ role: 'user' }),
        user_model_1.User.countDocuments({ isBlocked: true }),
        user_model_1.User.countDocuments({ agencyId: { $exists: true, $ne: null }, isBlocked: true }),
        agency_model_1.Agency.countDocuments(),
        agency_model_1.Agency.countDocuments({ status: 'active' }),
        user_model_1.User.countDocuments({ role: 'super_admin' }),
        user_model_1.User.countDocuments({ role: 'sub_admin' }),
        user_model_1.User.countDocuments({ role: 'top_up_agent' }),
        user_model_1.User.countDocuments({ role: 'reseller' }),
        registration_request_model_1.RegistrationRequest.countDocuments({ status: 'pending' }),
        support_chat_model_1.SupportChat.countDocuments(),
        user_model_1.User.findOne({ role: 'company_admin' }).select('beanWallet').lean(),
        getTop10(),
    ]);
    // Recent transactions summary
    const recentTx = await wallet_transaction_model_1.default.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('userId', 'username')
        .lean();
    // Agencies table (first 20)
    const agencies = await agency_model_1.Agency.find()
        .sort({ targetAchieved: -1 })
        .limit(20)
        .select('name agencyCode target targetAchieved sharePercent status')
        .lean();
    // Super admins summary
    const superAdmins = await user_model_1.User.find({ role: 'super_admin' })
        .select('username email phone isBlocked beanWallet diamonds createdAt')
        .limit(10)
        .lean();
    // Sub admins summary
    const subAdmins = await user_model_1.User.find({ role: 'sub_admin' })
        .select('username email phone isBlocked beanWallet diamonds createdAt')
        .limit(10)
        .lean();
    // Top ups with sales
    const topUpAgents = await user_model_1.User.find({ role: 'top_up_agent' })
        .select('username email beanWallet isBlocked createdAt')
        .limit(10)
        .lean();
    // Resellers with beans
    const resellers = await user_model_1.User.find({ role: 'reseller' })
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
async function superAdminDashboard(adminId, res) {
    const [subAdmins, agencies, resellers, withdrawals, admin, top10,] = await Promise.all([
        user_model_1.User.find({ role: 'sub_admin' })
            .select('username email phone sharePercent beanWallet diamonds isBlocked createdAt')
            .limit(20)
            .lean(),
        agency_model_1.Agency.find({ superAdminId: new mongoose_1.Types.ObjectId(adminId) })
            .select('name agencyCode target targetAchieved sharePercent status streamerIds')
            .limit(20)
            .lean(),
        user_model_1.User.find({ role: 'reseller' })
            .select('username email beanWallet sharePercent diamonds isBlocked createdAt')
            .limit(20)
            .lean(),
        withdrawal_request_model_1.WithdrawalRequest.find({ superAdminId: adminId })
            .sort({ requestedAt: -1 })
            .limit(20)
            .lean(),
        user_model_1.User.findById(adminId).select('sharePercent beanWallet diamonds').lean(),
        getTop10(),
    ]);
    const pendingWithdrawals = await withdrawal_request_model_1.WithdrawalRequest.countDocuments({ superAdminId: adminId, status: 'pending' });
    const pendingRegistrations = await registration_request_model_1.RegistrationRequest.countDocuments({ status: 'pending' });
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
async function subAdminDashboard(adminId, res) {
    const [agencies, withdrawals, admin, top10] = await Promise.all([
        agency_model_1.Agency.find({ subAdminId: new mongoose_1.Types.ObjectId(adminId) })
            .select('name agencyCode target targetAchieved sharePercent status streamerIds')
            .limit(20)
            .lean(),
        withdrawal_request_model_1.WithdrawalRequest.find({ superAdminId: adminId })
            .sort({ requestedAt: -1 })
            .limit(20)
            .lean(),
        user_model_1.User.findById(adminId).select('sharePercent beanWallet diamonds').lean(),
        getTop10(),
    ]);
    const pendingWithdrawals = await withdrawal_request_model_1.WithdrawalRequest.countDocuments({ superAdminId: adminId, status: 'pending' });
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
async function agencyDashboard(adminId, res) {
    const agency = await agency_model_1.Agency.findOne({ ownerId: adminId }).lean();
    // Hosts may have agencyId stored as ObjectId OR agencyCode string — match both
    const hostQuery = agency
        ? {
            $or: [
                { agencyId: agency._id },
                { agencyId: agency._id?.toString() },
                { agencyId: agency.agencyCode },
            ],
        }
        : { agencyId: adminId };
    const [hosts, withdrawals, top10] = await Promise.all([
        user_model_1.User.find(hostQuery)
            .select('username email phone diamonds rcoins beanWallet isBlocked isSuspended profilePic createdAt')
            .lean(),
        agency
            ? withdrawal_request_model_1.WithdrawalRequest.find({ agencyId: agency._id })
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
async function topUpAgentDashboard(adminId, res) {
    const [agent, beanRequests, beanTransfers, resellers, top10] = await Promise.all([
        user_model_1.User.findById(adminId).select('beanWallet sharePercent username').lean(),
        bean_transaction_model_1.BeanTransaction.find({ fromId: adminId, type: 'request' })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean(),
        bean_transaction_model_1.BeanTransaction.find({ fromId: adminId, type: { $in: ['assign', 'transfer'] } })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean(),
        user_model_1.User.find({ role: 'reseller', parentId: new mongoose_1.Types.ObjectId(adminId) })
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
async function resellerDashboard(adminId, res) {
    const [reseller, beanRequests, beanTransfers, top10] = await Promise.all([
        user_model_1.User.findById(adminId).select('beanWallet sharePercent username parentId').lean(),
        bean_transaction_model_1.BeanTransaction.find({ fromId: adminId, type: 'request' })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean(),
        bean_transaction_model_1.BeanTransaction.find({ fromId: adminId, type: { $in: ['assign', 'transfer'] } })
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
const getDashboard = async (req, res) => {
    try {
        const { id, role } = req.adminUser;
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
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getDashboard = getDashboard;
