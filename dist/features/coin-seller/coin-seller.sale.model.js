"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoinSellerSale = void 0;
const mongoose_1 = require("mongoose");
const CoinSellerSaleSchema = new mongoose_1.Schema({
    sellerId: { type: String, required: true, index: true },
    sellerUsername: { type: String, required: true },
    diamonds: { type: Number, required: true },
    revenueUsd: { type: Number, required: true },
}, { timestamps: true });
exports.CoinSellerSale = (0, mongoose_1.model)('CoinSellerSale', CoinSellerSaleSchema);
exports.default = exports.CoinSellerSale;
