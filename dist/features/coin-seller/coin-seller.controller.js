"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMySales = exports.recordSale = exports.getMyCoinSellerProfile = exports.applyAsCoinSeller = void 0;
const coin_seller_model_1 = require("./coin-seller.model");
const coin_seller_sale_model_1 = __importDefault(require("./coin-seller.sale.model"));
const user_model_1 = require("../auth/user.model");
const applyAsCoinSeller = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const { businessName } = req.body;
        const existing = await coin_seller_model_1.CoinSeller.findOne({ userId: req.user.id });
        if (existing) {
            res.status(400).json({ success: false, message: 'Application already submitted.' });
            return;
        }
        const user = await user_model_1.User.findById(req.user.id);
        const seller = await coin_seller_model_1.CoinSeller.create({
            userId: req.user.id,
            username: user?.username,
            businessName,
            isApproved: false,
        });
        res.status(201).json({ success: true, seller, message: 'Application submitted for admin approval.' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.applyAsCoinSeller = applyAsCoinSeller;
const getMyCoinSellerProfile = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const seller = await coin_seller_model_1.CoinSeller.findOne({ userId: req.user.id });
        res.status(200).json({ success: true, seller });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getMyCoinSellerProfile = getMyCoinSellerProfile;
const recordSale = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const { diamonds, revenueUsd } = req.body;
        if (!diamonds || !revenueUsd) {
            res.status(400).json({ success: false, message: 'Invalid sale data.' });
            return;
        }
        const seller = await coin_seller_model_1.CoinSeller.findOne({ userId: req.user.id });
        if (!seller || !seller.isApproved) {
            res.status(403).json({ success: false, message: 'Not an approved coin seller.' });
            return;
        }
        seller.diamondsSold = (seller.diamondsSold || 0) + Number(diamonds);
        seller.totalRevenue = (seller.totalRevenue || 0) + Number(revenueUsd);
        await seller.save();
        const sale = await coin_seller_sale_model_1.default.create({
            sellerId: seller.userId,
            sellerUsername: seller.username,
            diamonds: Number(diamonds),
            revenueUsd: Number(revenueUsd),
        });
        res.status(201).json({ success: true, sale, seller });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.recordSale = recordSale;
const getMySales = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const sales = await coin_seller_sale_model_1.default.find({ sellerId: req.user.id }).sort({ createdAt: -1 }).lean();
        res.status(200).json({ success: true, sales });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getMySales = getMySales;
