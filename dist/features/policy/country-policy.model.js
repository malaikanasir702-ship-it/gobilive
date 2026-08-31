"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CountryPolicy = void 0;
const mongoose_1 = require("mongoose");
const CountryPolicySchema = new mongoose_1.Schema({
    countryCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    countryName: { type: String, required: true, trim: true },
    currency: { type: String, required: true, uppercase: true, trim: true },
    marketRate: { type: Number, required: true, min: 0 },
    inAppRate: { type: Number, required: true, min: 0 },
    withdrawalChargePercent: { type: Number, required: true, default: 2.0, min: 0 },
    taxPercent: { type: Number, required: true, default: 0.0, min: 0 },
    isDefault: { type: Boolean, default: false },
}, { timestamps: true });
exports.CountryPolicy = (0, mongoose_1.model)('CountryPolicy', CountryPolicySchema);
