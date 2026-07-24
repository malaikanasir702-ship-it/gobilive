"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyGooglePlayPurchase = void 0;
const wallet_config_1 = require("./wallet.config");
const wallet_service_1 = require("./wallet.service");
const wallet_transaction_model_1 = __importDefault(require("./wallet.transaction.model"));
const verifyGooglePlayPurchase = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const { packageId, purchaseToken, productId, orderId } = req.body;
        const pack = wallet_config_1.DIAMOND_PACKAGES.find((p) => p.id === packageId || p.id === productId);
        if (!pack) {
            res.status(400).json({ success: false, message: 'Unknown package.' });
            return;
        }
        const tokenKey = purchaseToken || orderId;
        if (!tokenKey) {
            res.status(400).json({ success: false, message: 'purchaseToken or orderId required.' });
            return;
        }
        const existing = await wallet_transaction_model_1.default.findOne({
            'metadata.purchaseToken': tokenKey,
            status: 'completed',
        });
        if (existing) {
            res.status(200).json({ success: true, message: 'Already credited.', duplicate: true });
            return;
        }
        const totalDiamonds = pack.diamonds + pack.bonusDiamonds;
        await (0, wallet_service_1.creditDiamondsPurchase)(req.user.id, totalDiamonds, `iap_${tokenKey}`, pack.id);
        await wallet_transaction_model_1.default.findOneAndUpdate({ stripePaymentIntentId: `iap_${tokenKey}` }, { $set: { 'metadata.purchaseToken': tokenKey, 'metadata.platform': 'google_play' } });
        res.status(200).json({
            success: true,
            diamonds: totalDiamonds,
            message: `${totalDiamonds} diamonds added to your wallet.`,
        });
    }
    catch (error) {
        res.status(error.status || 500).json({
            success: false,
            message: error.message || 'IAP verification failed.',
        });
    }
};
exports.verifyGooglePlayPurchase = verifyGooglePlayPurchase;
