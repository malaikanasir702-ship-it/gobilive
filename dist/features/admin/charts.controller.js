"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCharts = void 0;
const user_model_1 = require("../auth/user.model");
const bean_transaction_model_1 = require("../beans/bean-transaction.model");
const wallet_transaction_model_1 = __importDefault(require("../wallet/wallet.transaction.model"));
const live_model_1 = __importDefault(require("../live/live.model"));
function getDaysArray(range) {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        result.push(d);
    }
    return result;
}
function formatDate(d) {
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
}
/**
 * GET /api/admin-panel/v1/dashboard/charts?range=7d|30d|90d
 * Returns time-series data for charts in Company Admin Dashboard.
 */
const getCharts = async (req, res) => {
    try {
        const range = (req.query.range || '7d');
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
            user_model_1.User.aggregate([
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
            bean_transaction_model_1.BeanTransaction.aggregate([
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
            wallet_transaction_model_1.default.aggregate([
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
            live_model_1.default.aggregate([
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
        const userMap = {};
        newUsers.forEach(u => { userMap[u._id] = u.count; });
        const beanAssignMap = {};
        const beanGenerateMap = {};
        const beanTransferMap = {};
        beanTxs.forEach(b => {
            const date = b._id.date;
            if (b._id.type === 'assign')
                beanAssignMap[date] = (beanAssignMap[date] || 0) + b.total;
            if (b._id.type === 'generate')
                beanGenerateMap[date] = (beanGenerateMap[date] || 0) + b.total;
            if (b._id.type === 'transfer')
                beanTransferMap[date] = (beanTransferMap[date] || 0) + b.total;
        });
        const revenueMap = {};
        walletTxs.forEach(w => { revenueMap[w._id] = { revenue: w.revenue, count: w.count }; });
        const streamMap = {};
        liveRooms.forEach(l => { streamMap[l._id] = l.count; });
        // ── Build unified per-day arrays ──────────────────────────────────────
        const userGrowth = days.map(d => ({
            date: formatDate(d),
            newUsers: userMap[formatDate(d)] ?? 0,
        }));
        const beanFlow = days.map(d => ({
            date: formatDate(d),
            assigned: beanAssignMap[formatDate(d)] ?? 0,
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
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getCharts = getCharts;
