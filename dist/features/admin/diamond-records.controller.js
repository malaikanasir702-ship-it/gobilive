"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listDiamondRecords = listDiamondRecords;
exports.getDiamondRecord = getDiamondRecord;
const wallet_transaction_model_1 = __importDefault(require("../wallet/wallet.transaction.model"));
async function listDiamondRecords(req, res) {
    const { userId, type, page = 1, limit = 50, from, to } = req.query;
    const adminUser = req.adminUser;
    const filter = { currency: 'diamonds' };
    if (userId)
        filter.userId = userId;
    if (type)
        filter.type = type;
    if (from || to)
        filter.createdAt = {};
    if (from)
        filter.createdAt.$gte = new Date(from);
    if (to)
        filter.createdAt.$lte = new Date(to);
    // super_admin / sub_admin: scope to their agencies' hosts
    if (adminUser?.role === 'super_admin' || adminUser?.role === 'sub_admin') {
        try {
            const { Agency } = await Promise.resolve().then(() => __importStar(require('../agency/agency.model')));
            const agencyQuery = adminUser.role === 'super_admin'
                ? { superAdminId: adminUser.id }
                : { subAdminId: adminUser.id };
            const myAgencies = await Agency.find(agencyQuery).select('_id agencyCode').lean();
            if (!myAgencies.length) {
                return res.json({ data: [], total: 0 });
            }
            const { User } = await Promise.resolve().then(() => __importStar(require('../auth/user.model')));
            const agencyRefs = myAgencies.flatMap((a) => [String(a._id), ...(a.agencyCode ? [a.agencyCode] : [])]);
            const hosts = await User.find({ agencyId: { $in: agencyRefs } }).select('_id').lean();
            const hostIds = hosts.map((h) => String(h._id));
            if (!hostIds.length)
                return res.json({ data: [], total: 0 });
            filter.userId = { $in: hostIds };
        }
        catch (_) { }
    }
    const docs = await wallet_transaction_model_1.default.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit));
    const total = await wallet_transaction_model_1.default.countDocuments(filter);
    res.json({ data: docs, total });
}
async function getDiamondRecord(req, res) {
    const { id } = req.params;
    const doc = await wallet_transaction_model_1.default.findById(id);
    if (!doc)
        return res.status(404).json({ error: 'Not found' });
    res.json(doc);
}
exports.default = {};
