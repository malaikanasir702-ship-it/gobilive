"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyPayouts = exports.requestPayout = void 0;
const agency_model_1 = require("./agency.model");
const agency_payout_model_1 = __importDefault(require("./agency-payout.model"));
const requestPayout = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const { amount, method, details } = req.body;
        const agency = await agency_model_1.Agency.findOne({ ownerId: req.user.id });
        if (!agency) {
            res.status(404).json({ success: false, message: 'Agency not found.' });
            return;
        }
        if (!amount || amount <= 0) {
            res.status(400).json({ success: false, message: 'Invalid amount.' });
            return;
        }
        if (agency.walletBalance < amount) {
            res.status(400).json({ success: false, message: 'Insufficient agency wallet balance.' });
            return;
        }
        // deduct from agency wallet and create payout record
        agency.walletBalance = Math.max(0, agency.walletBalance - amount);
        await agency.save();
        const payout = await agency_payout_model_1.default.create({
            agencyId: agency.id,
            agencyName: agency.name,
            amount,
            method: method || 'bank',
            details: details || '',
            status: 'pending',
        });
        res.status(201).json({ success: true, payout });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.requestPayout = requestPayout;
const getMyPayouts = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const agency = await agency_model_1.Agency.findOne({ ownerId: req.user.id });
        if (!agency) {
            res.status(404).json({ success: false, message: 'Agency not found.' });
            return;
        }
        const payouts = await agency_payout_model_1.default.find({ agencyId: agency.id }).sort({ createdAt: -1 }).lean();
        res.status(200).json({ success: true, payouts });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getMyPayouts = getMyPayouts;
