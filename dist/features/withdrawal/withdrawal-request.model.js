"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WithdrawalRequest = void 0;
const mongoose_1 = require("mongoose");
const WithdrawalRequestSchema = new mongoose_1.Schema({
    hostId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    hostName: { type: String, required: true },
    agencyId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Agency', sparse: true },
    superAdminId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', sparse: true },
    diamondsRequested: { type: Number, required: true, min: 1 },
    amountInLocalCurrency: { type: Number, required: true, min: 0 },
    currencyCode: { type: String, required: true, default: 'PKR' },
    status: {
        type: String,
        enum: ['pending', 'approved', 'done', 'rejected'],
        default: 'pending',
    },
    transferSlipUrl: { type: String },
    rejectionReason: { type: String },
    requestedAt: { type: Date, default: Date.now },
    approvedAt: { type: Date },
    completedAt: { type: Date },
}, { timestamps: true });
WithdrawalRequestSchema.index({ hostId: 1, createdAt: -1 });
WithdrawalRequestSchema.index({ superAdminId: 1, status: 1 });
WithdrawalRequestSchema.index({ status: 1, createdAt: -1 });
WithdrawalRequestSchema.index({ agencyId: 1, createdAt: -1 });
exports.WithdrawalRequest = (0, mongoose_1.model)('WithdrawalRequest', WithdrawalRequestSchema);
