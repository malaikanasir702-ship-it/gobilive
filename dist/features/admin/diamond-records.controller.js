"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listDiamondRecords = listDiamondRecords;
exports.getDiamondRecord = getDiamondRecord;
const wallet_transaction_model_1 = __importDefault(require("../wallet/wallet.transaction.model"));
async function listDiamondRecords(req, res) {
    const { userId, type, page = 1, limit = 50, from, to } = req.query;
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
