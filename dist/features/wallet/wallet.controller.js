"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeWebhook = exports.purchaseVipWithDiamonds = exports.getMyWithdrawals = exports.withdrawRcoinsHandler = exports.convertBeansToDiamondsHandler = exports.convertDiamonds = exports.confirmPayment = exports.createPaymentIntent = exports.getCatalog = exports.getTransactions = exports.getBalance = void 0;
const stripe_1 = __importDefault(require("stripe"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const user_model_1 = require("../auth/user.model");
const wallet_config_1 = require("./wallet.config");
const notification_service_1 = require("../notifications/notification.service");
const wallet_service_1 = require("./wallet.service");
// wallet.controller is imported early during app boot; ensure env is loaded before using Stripe key.
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '.env') });
const stripeSecretKey = (process.env.STRIPE_SECRET_KEY ?? '').trim();
const stripe = new stripe_1.default(stripeSecretKey || 'sk_test_placeholder');
async function pushWalletNotification(userId, payload) {
    (0, notification_service_1.sendToUser)(userId, payload).catch((err) => console.warn('FCM wallet notification failed:', err.message));
}
const getBalance = async (req, res) => {
    try {
        const balance = await (0, wallet_service_1.getWalletBalance)(req.user.id);
        res.status(200).json({ success: true, balance });
    }
    catch (e) {
        res.status(e.status || 500).json({ success: false, message: e.message });
    }
};
exports.getBalance = getBalance;
const getTransactions = async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 30, 100);
        const transactions = await (0, wallet_service_1.getTransactionHistory)(req.user.id, limit);
        res.status(200).json({ success: true, transactions });
    }
    catch (e) {
        res.status(e.status || 500).json({ success: false, message: e.message });
    }
};
exports.getTransactions = getTransactions;
const getCatalog = async (_req, res) => {
    res.status(200).json({
        success: true,
        diamondPackages: wallet_config_1.DIAMOND_PACKAGES,
        vipPlans: wallet_config_1.VIP_PLANS,
        badges: wallet_config_1.BADGE_CATALOG,
        conversionRate: wallet_config_1.DIAMOND_TO_RCOIN_RATE,
        publishableKey: (process.env.STRIPE_PUBLISHABLE_KEY ?? '').trim() || 'pk_test_placeholder',
        stripeMockMode: (0, wallet_service_1.isStripeMockMode)(),
    });
};
exports.getCatalog = getCatalog;
const createPaymentIntent = async (req, res) => {
    try {
        const { packageId, purchaseType = 'diamonds', planId } = req.body;
        const userId = req.user.id;
        if (purchaseType === 'vip') {
            const plan = wallet_config_1.VIP_PLANS.find((p) => p.id === planId);
            if (!plan) {
                res.status(400).json({ success: false, message: 'Invalid VIP plan.' });
                return;
            }
            if ((0, wallet_service_1.isStripeMockMode)()) {
                const mockId = `mock_pi_vip_${Date.now()}`;
                res.status(200).json({
                    success: true,
                    clientSecret: `${mockId}_secret`,
                    paymentIntentId: mockId,
                    amount: plan.priceUsdCents,
                    purchaseType: 'vip',
                    planId: plan.id,
                    stripeMockMode: true,
                });
                return;
            }
            const intent = await stripe.paymentIntents.create({
                amount: plan.priceUsdCents,
                currency: 'usd',
                metadata: { userId, purchaseType: 'vip', planId: plan.id },
            });
            res.status(200).json({
                success: true,
                clientSecret: intent.client_secret,
                paymentIntentId: intent.id,
                amount: plan.priceUsdCents,
                purchaseType: 'vip',
                planId: plan.id,
            });
            return;
        }
        const pack = (0, wallet_service_1.getPackageById)(packageId);
        if (!pack) {
            res.status(400).json({ success: false, message: 'Invalid diamond package.' });
            return;
        }
        const totalDiamonds = pack.diamonds + pack.bonusDiamonds;
        if ((0, wallet_service_1.isStripeMockMode)()) {
            const mockId = `mock_pi_${Date.now()}`;
            res.status(200).json({
                success: true,
                clientSecret: `${mockId}_secret`,
                paymentIntentId: mockId,
                amount: pack.priceUsdCents,
                diamonds: totalDiamonds,
                packageId: pack.id,
                stripeMockMode: true,
            });
            return;
        }
        const intent = await stripe.paymentIntents.create({
            amount: pack.priceUsdCents,
            currency: 'usd',
            metadata: {
                userId,
                purchaseType: 'diamonds',
                packageId: pack.id,
                diamonds: String(totalDiamonds),
            },
        });
        res.status(200).json({
            success: true,
            clientSecret: intent.client_secret,
            paymentIntentId: intent.id,
            amount: pack.priceUsdCents,
            diamonds: totalDiamonds,
            packageId: pack.id,
        });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};
exports.createPaymentIntent = createPaymentIntent;
const confirmPayment = async (req, res) => {
    try {
        const { paymentIntentId, packageId, purchaseType = 'diamonds', planId } = req.body;
        const userId = req.user.id;
        if ((0, wallet_service_1.isStripeMockMode)()) {
            if (purchaseType === 'vip' && planId) {
                const result = await (0, wallet_service_1.activateVipFromStripe)(userId, planId, paymentIntentId);
                await pushWalletNotification(userId, notification_service_1.NotificationTriggers.vipActivated(result.plan.name));
                const user = await user_model_1.User.findById(userId).select('-passwordHash');
                res.status(200).json({ success: true, message: 'VIP activated (mock).', user, ...result });
                return;
            }
            const pack = (0, wallet_service_1.getPackageById)(packageId);
            if (!pack) {
                res.status(400).json({ success: false, message: 'Invalid package.' });
                return;
            }
            const totalDiamonds = pack.diamonds + pack.bonusDiamonds;
            await (0, wallet_service_1.creditDiamondsPurchase)(userId, totalDiamonds, paymentIntentId, packageId);
            await pushWalletNotification(userId, notification_service_1.NotificationTriggers.walletTopUp(totalDiamonds));
            const user = await user_model_1.User.findById(userId).select('-passwordHash');
            res.status(200).json({
                success: true,
                message: `${totalDiamonds} diamonds added (mock payment).`,
                user,
            });
            return;
        }
        const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (intent.status !== 'succeeded') {
            res.status(400).json({ success: false, message: 'Payment not completed yet.' });
            return;
        }
        if (intent.metadata.purchaseType === 'vip') {
            const result = await (0, wallet_service_1.activateVipFromStripe)(userId, intent.metadata.planId, paymentIntentId);
            await pushWalletNotification(userId, notification_service_1.NotificationTriggers.vipActivated(result.plan.name));
            const user = await user_model_1.User.findById(userId).select('-passwordHash');
            res.status(200).json({ success: true, message: 'VIP activated.', user, ...result });
            return;
        }
        const diamonds = parseInt(intent.metadata.diamonds || '0', 10);
        await (0, wallet_service_1.creditDiamondsPurchase)(userId, diamonds, paymentIntentId, intent.metadata.packageId || packageId);
        await pushWalletNotification(userId, notification_service_1.NotificationTriggers.walletTopUp(diamonds));
        const user = await user_model_1.User.findById(userId).select('-passwordHash');
        res.status(200).json({ success: true, message: 'Diamonds credited.', user });
    }
    catch (e) {
        res.status(e.status || 500).json({ success: false, message: e.message });
    }
};
exports.confirmPayment = confirmPayment;
const convertDiamonds = async (req, res) => {
    try {
        const { diamondAmount } = req.body;
        const ledger = await (0, wallet_service_1.convertDiamondsToRcoins)(req.user.id, diamondAmount);
        const user = await user_model_1.User.findById(req.user.id).select('-passwordHash');
        res.status(200).json({
            success: true,
            message: 'Conversion successful.',
            transaction: ledger,
            user,
        });
    }
    catch (e) {
        const status = e instanceof wallet_service_1.WalletServiceError ? e.status : 500;
        res.status(status).json({ success: false, message: e.message });
    }
};
exports.convertDiamonds = convertDiamonds;
const convertBeansToDiamondsHandler = async (req, res) => {
    try {
        const { beansAmount } = req.body;
        if (!beansAmount || Number(beansAmount) <= 0) {
            res.status(400).json({ success: false, message: 'Valid beansAmount is required.' });
            return;
        }
        const ledger = await (0, wallet_service_1.convertBeansToDiamonds)(req.user.id, Number(beansAmount));
        const user = await user_model_1.User.findById(req.user.id).select('-passwordHash');
        res.status(200).json({
            success: true,
            message: 'Successfully converted Beans to Diamonds!',
            transaction: ledger,
            user,
        });
    }
    catch (e) {
        const status = e instanceof wallet_service_1.WalletServiceError ? e.status : 500;
        res.status(status).json({ success: false, message: e.message });
    }
};
exports.convertBeansToDiamondsHandler = convertBeansToDiamondsHandler;
const withdrawRcoinsHandler = async (req, res) => {
    try {
        const { rcoinAmount, diamondsAmount, amount, payoutMethod, payoutDetails } = req.body;
        const withdrawQty = Number(diamondsAmount ?? amount ?? rcoinAmount ?? 0);
        const result = await (0, wallet_service_1.requestDiamondWithdrawal)(req.user.id, withdrawQty, payoutMethod || 'bank', payoutDetails || '');
        const user = await user_model_1.User.findById(req.user.id).select('-passwordHash');
        res.status(200).json({
            success: true,
            message: 'Withdrawal request submitted successfully! Pending admin approval.',
            withdrawal: result.withdrawal,
            transaction: result.ledger,
            user,
        });
    }
    catch (e) {
        const status = e instanceof wallet_service_1.WalletServiceError ? e.status : 500;
        res.status(status).json({ success: false, message: e.message });
    }
};
exports.withdrawRcoinsHandler = withdrawRcoinsHandler;
const getMyWithdrawals = async (req, res) => {
    try {
        const { WithdrawalRequest } = await Promise.resolve().then(() => __importStar(require('../withdrawal/withdrawal-request.model')));
        const docs = await WithdrawalRequest.find({ hostId: req.user.id }).sort({ requestedAt: -1 }).lean();
        res.status(200).json({ success: true, withdrawals: docs });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};
exports.getMyWithdrawals = getMyWithdrawals;
const purchaseVipWithDiamonds = async (req, res) => {
    try {
        const { planId } = req.body;
        const result = await (0, wallet_service_1.activateVipWithDiamonds)(req.user.id, planId);
        await pushWalletNotification(req.user.id, notification_service_1.NotificationTriggers.vipActivated(result.plan.name));
        const user = await user_model_1.User.findById(req.user.id).select('-passwordHash');
        res.status(200).json({
            success: true,
            message: 'VIP membership activated.',
            user,
            ...result,
        });
    }
    catch (e) {
        const status = e instanceof wallet_service_1.WalletServiceError ? e.status : 500;
        res.status(status).json({ success: false, message: e.message });
    }
};
exports.purchaseVipWithDiamonds = purchaseVipWithDiamonds;
const stripeWebhook = async (req, res) => {
    if ((0, wallet_service_1.isStripeMockMode)()) {
        res.status(200).json({ received: true, mock: true });
        return;
    }
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    try {
        let event;
        if (webhookSecret && sig) {
            event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        }
        else {
            event = req.body;
        }
        if (event.type === 'payment_intent.succeeded') {
            const intent = event.data.object;
            const userId = intent.metadata.userId;
            if (!userId) {
                res.status(200).json({ received: true });
                return;
            }
            if (intent.metadata.purchaseType === 'vip') {
                await (0, wallet_service_1.activateVipFromStripe)(userId, intent.metadata.planId, intent.id);
            }
            else {
                const diamonds = parseInt(intent.metadata.diamonds || '0', 10);
                await (0, wallet_service_1.creditDiamondsPurchase)(userId, diamonds, intent.id, intent.metadata.packageId || '');
            }
        }
        res.status(200).json({ received: true });
    }
    catch (e) {
        res.status(400).json({ success: false, message: e.message });
    }
};
exports.stripeWebhook = stripeWebhook;
