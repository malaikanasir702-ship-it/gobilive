"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgencyPayout = void 0;
const mongoose_1 = require("mongoose");
const AgencyPayoutSchema = new mongoose_1.Schema({
    agencyId: { type: String, required: true, index: true },
    agencyName: { type: String, required: true },
    amount: { type: Number, required: true },
    method: { type: String, required: true },
    details: { type: String },
    status: { type: String, enum: ['pending', 'completed', 'failed', 'cancelled'], default: 'pending' },
}, { timestamps: true });
exports.AgencyPayout = (0, mongoose_1.model)('AgencyPayout', AgencyPayoutSchema);
exports.default = exports.AgencyPayout;
