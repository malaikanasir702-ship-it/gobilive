"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoinSeller = void 0;
const mongoose_1 = require("mongoose");
const CoinSellerSchema = new mongoose_1.Schema({
    userId: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    businessName: { type: String, required: true },
    diamondsSold: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    isApproved: { type: Boolean, default: false },
}, { timestamps: true });
exports.CoinSeller = (0, mongoose_1.model)('CoinSeller', CoinSellerSchema);
