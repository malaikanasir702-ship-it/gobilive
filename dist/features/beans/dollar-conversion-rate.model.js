"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DollarConversionRate = void 0;
const mongoose_1 = require("mongoose");
const DollarConversionRateSchema = new mongoose_1.Schema({
    countryCode: { type: String, required: true, unique: true, uppercase: true },
    countryName: { type: String, required: true },
    rate: { type: Number, required: true, min: 0 },
}, { timestamps: true });
exports.DollarConversionRate = (0, mongoose_1.model)('DollarConversionRate', DollarConversionRateSchema);
