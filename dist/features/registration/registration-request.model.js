"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegistrationRequest = void 0;
const mongoose_1 = require("mongoose");
const RegistrationRequestSchema = new mongoose_1.Schema({
    role: {
        type: String,
        enum: ['super_admin', 'sub_admin', 'agency', 'top_up_agent', 'reseller', 'host'],
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
    },
    formData: {
        fullName: { type: String },
        email: { type: String },
        phone: { type: String },
        idCardNumber: { type: String },
        region: { type: String },
        country: { type: String },
        bankName: { type: String },
        bankAccountNumber: { type: String },
        cardNumber: { type: String },
        agencyCode: { type: String },
        parentId: { type: String },
    },
    documentUrls: { type: [String], default: [] },
    reviewedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', sparse: true },
    reviewedAt: { type: Date },
    rejectionReason: { type: String },
    generatedId: { type: String },
}, { timestamps: { createdAt: true, updatedAt: false } });
RegistrationRequestSchema.index({ role: 1, status: 1, createdAt: -1 });
exports.RegistrationRequest = (0, mongoose_1.model)('RegistrationRequest', RegistrationRequestSchema);
