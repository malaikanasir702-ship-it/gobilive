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
exports.WalletServiceError = void 0;
exports.getWalletBalance = getWalletBalance;
exports.getTransactionHistory = getTransactionHistory;
exports.creditDiamondsPurchase = creditDiamondsPurchase;
exports.convertDiamondsToRcoins = convertDiamondsToRcoins;
exports.convertBeansToDiamonds = convertBeansToDiamonds;
exports.withdrawRcoins = withdrawRcoins;
exports.requestDiamondWithdrawal = requestDiamondWithdrawal;
exports.activateVipWithDiamonds = activateVipWithDiamonds;
exports.activateVipFromStripe = activateVipFromStripe;
exports.getPackageById = getPackageById;
exports.isStripeMockMode = isStripeMockMode;
exports.creditBonusDiamonds = creditBonusDiamonds;
exports.spendVideoCallRcoins = spendVideoCallRcoins;
exports.spendGiftDiamonds = spendGiftDiamonds;
const mongoose_1 = __importDefault(require("mongoose"));
const user_model_1 = require("../auth/user.model");
const wallet_transaction_model_1 = __importDefault(require("./wallet.transaction.model"));
const wallet_config_1 = require("./wallet.config");
class WalletServiceError extends Error {
    status;
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}
exports.WalletServiceError = WalletServiceError;
function isMongoTxnUnsupported(err) {
    const msg = String(err?.message ?? err);
    return (msg.includes('Transaction numbers are only allowed') ||
        msg.includes('replica set member') ||
        msg.includes('mongos'));
}
async function applyBalanceChangeNoTx(userId, deltas, tx) {
    const diamondsDelta = deltas.diamonds ?? 0;
    const rcoinsDelta = deltas.rcoins ?? 0; // treated as beanWallet delta
    const query = { _id: userId };
    if (diamondsDelta < 0)
        query.diamonds = { $gte: Math.abs(diamondsDelta) };
    if (rcoinsDelta < 0)
        query.beanWallet = { $gte: Math.abs(rcoinsDelta) };
    // beanWallet is canonical — rcoins is NOT updated
    const incUpdate = { diamonds: diamondsDelta };
    if (rcoinsDelta !== 0)
        incUpdate.beanWallet = rcoinsDelta;
    const updatedUser = await user_model_1.User.findOneAndUpdate(query, { $inc: incUpdate }, { new: true });
    if (!updatedUser) {
        const exists = await user_model_1.User.findById(userId).select('_id');
        if (!exists)
            throw new WalletServiceError('User not found.', 404);
        if (diamondsDelta < 0)
            throw new WalletServiceError('Insufficient diamonds.');
        if (rcoinsDelta < 0)
            throw new WalletServiceError('Insufficient Beans.');
        throw new WalletServiceError('Balance update failed.');
    }
    const beanBalance = updatedUser.beanWallet ?? 0;
    const ledger = await wallet_transaction_model_1.default.create({
        userId: updatedUser._id,
        type: tx.type,
        currency: tx.currency,
        amount: tx.amount,
        diamondsDelta,
        rcoinsDelta,
        diamondsBalance: updatedUser.diamonds,
        rcoinsBalance: beanBalance,
        status: tx.status ?? 'completed',
        stripePaymentIntentId: tx.stripePaymentIntentId,
        description: tx.description,
        metadata: tx.metadata,
    });
    return ledger;
}
async function applyBalanceChange(userId, deltas, tx, session) {
    // If we don't have a real transaction session (e.g., standalone Mongo), fall back.
    if (!session) {
        return applyBalanceChangeNoTx(userId, deltas, tx);
    }
    const user = await user_model_1.User.findById(userId).session(session);
    if (!user)
        throw new WalletServiceError('User not found.', 404);
    const diamondsDelta = deltas.diamonds ?? 0;
    const rcoinsDelta = deltas.rcoins ?? 0; // treated as beanWallet delta
    const currentBeans = user.beanWallet ?? 0;
    const newDiamonds = user.diamonds + diamondsDelta;
    const newBeans = currentBeans + rcoinsDelta;
    if (newDiamonds < 0)
        throw new WalletServiceError('Insufficient diamonds.');
    if (newBeans < 0)
        throw new WalletServiceError('Insufficient Beans.');
    user.diamonds = newDiamonds;
    // beanWallet is canonical — do NOT touch rcoins field
    if (rcoinsDelta !== 0) {
        user.beanWallet = newBeans;
    }
    await user.save({ session });
    const beanBalance = user.beanWallet ?? 0;
    const ledger = await wallet_transaction_model_1.default.create([
        {
            userId: user._id,
            type: tx.type,
            currency: tx.currency,
            amount: tx.amount,
            diamondsDelta,
            rcoinsDelta,
            diamondsBalance: newDiamonds,
            rcoinsBalance: beanBalance,
            status: tx.status ?? 'completed',
            stripePaymentIntentId: tx.stripePaymentIntentId,
            description: tx.description,
            metadata: tx.metadata,
        },
    ], { session });
    return ledger[0];
}
async function getWalletBalance(userId) {
    const user = await user_model_1.User.findById(userId).select('diamonds beanWallet isVIP vipFrame badges vipExpiresAt');
    if (!user)
        throw new WalletServiceError('User not found.', 404);
    const isVipActive = user.isVIP && (!user.vipExpiresAt || user.vipExpiresAt > new Date());
    // beanWallet is the single source of truth — rcoins is legacy
    const beanBalance = user.beanWallet ?? 0;
    return {
        diamonds: user.diamonds,
        rcoins: beanBalance, // kept for backwards-compat with existing Flutter field
        beanWallet: beanBalance,
        isVIP: isVipActive,
        vipFrame: user.vipFrame,
        badges: user.badges ?? [],
        vipExpiresAt: user.vipExpiresAt,
    };
}
async function getTransactionHistory(userId, limit = 30) {
    return wallet_transaction_model_1.default.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
}
async function creditDiamondsPurchase(userId, diamonds, stripePaymentIntentId, packageId) {
    const session = await mongoose_1.default.startSession();
    try {
        session.startTransaction();
        const existing = await wallet_transaction_model_1.default.findOne({
            stripePaymentIntentId,
            status: 'completed',
        }).session(session);
        if (existing) {
            await session.abortTransaction();
            return existing;
        }
        const ledger = await applyBalanceChange(userId, { diamonds }, {
            type: 'purchase_diamonds',
            currency: 'usd',
            amount: diamonds,
            description: `Purchased ${diamonds} diamonds (${packageId})`,
            status: 'completed',
            stripePaymentIntentId,
            metadata: { packageId },
        }, session);
        await session.commitTransaction();
        return ledger;
    }
    catch (e) {
        await session.abortTransaction().catch(() => undefined);
        if (isMongoTxnUnsupported(e)) {
            const existing = await wallet_transaction_model_1.default.findOne({
                stripePaymentIntentId,
                status: 'completed',
            });
            if (existing)
                return existing;
            return await applyBalanceChangeNoTx(userId, { diamonds }, {
                type: 'purchase_diamonds',
                currency: 'usd',
                amount: diamonds,
                description: `Purchased ${diamonds} diamonds (${packageId})`,
                status: 'completed',
                stripePaymentIntentId,
                metadata: { packageId },
            });
        }
        throw e;
    }
    finally {
        session.endSession();
    }
}
async function convertDiamondsToRcoins(userId, diamondAmount) {
    if (diamondAmount < wallet_config_1.MIN_CONVERT_DIAMONDS) {
        throw new WalletServiceError(`Minimum ${wallet_config_1.MIN_CONVERT_DIAMONDS} diamonds to convert.`);
    }
    if (diamondAmount % wallet_config_1.DIAMOND_TO_RCOIN_RATE !== 0) {
        throw new WalletServiceError(`Diamonds must be a multiple of ${wallet_config_1.DIAMOND_TO_RCOIN_RATE}.`);
    }
    const rcoinsGained = diamondAmount / wallet_config_1.DIAMOND_TO_RCOIN_RATE;
    const session = await mongoose_1.default.startSession();
    try {
        session.startTransaction();
        const ledger = await applyBalanceChange(userId, { diamonds: -diamondAmount, rcoins: rcoinsGained }, {
            type: 'convert_diamonds_to_rcoins',
            currency: 'diamonds',
            amount: diamondAmount,
            description: `Converted ${diamondAmount} diamonds → ${rcoinsGained} Beans`,
            metadata: { rate: wallet_config_1.DIAMOND_TO_RCOIN_RATE },
        }, session);
        await session.commitTransaction();
        return ledger;
    }
    catch (e) {
        await session.abortTransaction().catch(() => undefined);
        if (isMongoTxnUnsupported(e)) {
            return await applyBalanceChangeNoTx(userId, { diamonds: -diamondAmount, rcoins: rcoinsGained }, {
                type: 'convert_diamonds_to_rcoins',
                currency: 'diamonds',
                amount: diamondAmount,
                description: `Converted ${diamondAmount} diamonds → ${rcoinsGained} Beans`,
                metadata: { rate: wallet_config_1.DIAMOND_TO_RCOIN_RATE },
            });
        }
        throw e;
    }
    finally {
        session.endSession();
    }
}
async function convertBeansToDiamonds(userId, beansAmount) {
    if (beansAmount <= 0) {
        throw new WalletServiceError('Amount of Beans must be positive.');
    }
    // Get conversion rate from PlatformSettings or default 10 Beans = 1 Diamond
    const { getPlatformSettings } = await Promise.resolve().then(() => __importStar(require('../settings/platform-settings.model')));
    const settings = await getPlatformSettings();
    const rate = settings.diamondToBeanRate || 10; // 10 Beans per Diamond
    if (beansAmount < rate) {
        throw new WalletServiceError(`Minimum ${rate} Beans required to convert.`);
    }
    const diamondsGained = Math.floor(beansAmount / rate);
    const actualBeansUsed = diamondsGained * rate;
    const user = await user_model_1.User.findOneAndUpdate({ _id: userId, beanWallet: { $gte: actualBeansUsed } }, { $inc: { beanWallet: -actualBeansUsed, diamonds: diamondsGained } }, { new: true });
    if (!user) {
        throw new WalletServiceError('Insufficient Beans balance.');
    }
    const beanBalance = user.beanWallet ?? 0;
    const ledger = await wallet_transaction_model_1.default.create({
        userId: user._id,
        type: 'convert_beans_to_diamonds',
        currency: 'beans',
        amount: actualBeansUsed,
        diamondsDelta: diamondsGained,
        rcoinsDelta: -actualBeansUsed,
        diamondsBalance: user.diamonds,
        rcoinsBalance: beanBalance,
        status: 'completed',
        description: `Converted ${actualBeansUsed} Beans → ${diamondsGained} 💎`,
        metadata: { rate, diamondsGained, beansUsed: actualBeansUsed },
    });
    return ledger;
}
async function withdrawRcoins(userId, rcoinAmount, payoutMethod, payoutDetails) {
    if (rcoinAmount < wallet_config_1.MIN_WITHDRAW_RCOINS) {
        throw new WalletServiceError(`Minimum withdrawal is ${wallet_config_1.MIN_WITHDRAW_RCOINS} Beans.`);
    }
    const session = await mongoose_1.default.startSession();
    try {
        session.startTransaction();
        const ledger = await applyBalanceChange(userId, { rcoins: -rcoinAmount }, {
            type: 'withdraw_rcoins',
            currency: 'rcoins',
            amount: rcoinAmount,
            description: `Withdrawal request: ${rcoinAmount} Beans`,
            status: 'pending',
            metadata: { payoutMethod, payoutDetails },
        }, session);
        await session.commitTransaction();
        return ledger;
    }
    catch (e) {
        await session.abortTransaction().catch(() => undefined);
        if (isMongoTxnUnsupported(e)) {
            return await applyBalanceChangeNoTx(userId, { rcoins: -rcoinAmount }, {
                type: 'withdraw_rcoins',
                currency: 'rcoins',
                amount: rcoinAmount,
                description: `Withdrawal request: ${rcoinAmount} Beans`,
                status: 'pending',
                metadata: { payoutMethod, payoutDetails },
            });
        }
        throw e;
    }
    finally {
        session.endSession();
    }
}
async function requestDiamondWithdrawal(userId, diamondsAmount, payoutMethod, payoutDetails) {
    if (diamondsAmount < 10) {
        throw new WalletServiceError('Minimum withdrawal is 10 Diamonds.');
    }
    const { getPlatformSettings } = await Promise.resolve().then(() => __importStar(require('../settings/platform-settings.model')));
    const settings = await getPlatformSettings();
    const beanDollarUsd = settings.beanDollarRateUsd || 1;
    const beanDollarBeans = settings.beanDollarRateBeans || 100;
    const amountInUsd = (diamondsAmount / beanDollarBeans) * beanDollarUsd;
    const user = await user_model_1.User.findOneAndUpdate({ _id: userId, diamonds: { $gte: diamondsAmount } }, { $inc: { diamonds: -diamondsAmount } }, { new: true });
    if (!user) {
        throw new WalletServiceError('Insufficient Diamonds balance.');
    }
    const { WithdrawalRequest } = await Promise.resolve().then(() => __importStar(require('../withdrawal/withdrawal-request.model')));
    const withdrawal = await WithdrawalRequest.create({
        hostId: user._id,
        hostName: user.username,
        diamondsRequested: diamondsAmount,
        amountInLocalCurrency: Number(amountInUsd.toFixed(2)),
        currencyCode: 'USD',
        status: 'pending',
        requestedAt: new Date(),
    });
    const ledger = await wallet_transaction_model_1.default.create({
        userId: user._id,
        type: 'withdraw_rcoins',
        currency: 'diamonds',
        amount: diamondsAmount,
        diamondsDelta: -diamondsAmount,
        rcoinsDelta: 0,
        diamondsBalance: user.diamonds,
        rcoinsBalance: user.beanWallet ?? 0,
        status: 'pending',
        description: `Withdrawal request: ${diamondsAmount} 💎 ($${amountInUsd.toFixed(2)} USD via ${payoutMethod || 'Bank'})`,
        metadata: { withdrawalRequestId: withdrawal._id, payoutMethod, payoutDetails },
    });
    return { withdrawal, ledger };
}
async function activateVipWithDiamonds(userId, planId) {
    const plan = wallet_config_1.VIP_PLANS.find((p) => p.id === planId);
    if (!plan)
        throw new WalletServiceError('VIP plan not found.');
    const session = await mongoose_1.default.startSession();
    try {
        session.startTransaction();
        await applyBalanceChange(userId, { diamonds: -plan.diamondPrice }, {
            type: 'vip_purchase',
            currency: 'diamonds',
            amount: plan.diamondPrice,
            description: `VIP purchase: ${plan.name}`,
            metadata: { planId, paymentMethod: 'diamonds' },
        }, session);
        const user = await user_model_1.User.findById(userId).session(session);
        if (!user)
            throw new WalletServiceError('User not found.', 404);
        const now = new Date();
        const base = user.vipExpiresAt && user.vipExpiresAt > now ? user.vipExpiresAt : now;
        const expires = new Date(base);
        expires.setDate(expires.getDate() + plan.durationDays);
        user.isVIP = true;
        user.vipFrame = plan.vipFrame;
        user.vipExpiresAt = expires;
        const badges = new Set(user.badges ?? []);
        badges.add(plan.badge);
        user.badges = Array.from(badges);
        await user.save({ session });
        await session.commitTransaction();
        return { plan, vipExpiresAt: expires, badges: user.badges };
    }
    catch (e) {
        await session.abortTransaction().catch(() => undefined);
        if (isMongoTxnUnsupported(e)) {
            await applyBalanceChangeNoTx(userId, { diamonds: -plan.diamondPrice }, {
                type: 'vip_purchase',
                currency: 'diamonds',
                amount: plan.diamondPrice,
                description: `VIP purchase: ${plan.name}`,
                metadata: { planId, paymentMethod: 'diamonds' },
            });
            const user = await user_model_1.User.findById(userId);
            if (!user)
                throw new WalletServiceError('User not found.', 404);
            const now = new Date();
            const base = user.vipExpiresAt && user.vipExpiresAt > now ? user.vipExpiresAt : now;
            const expires = new Date(base);
            expires.setDate(expires.getDate() + plan.durationDays);
            user.isVIP = true;
            user.vipFrame = plan.vipFrame;
            user.vipExpiresAt = expires;
            const badges = new Set(user.badges ?? []);
            badges.add(plan.badge);
            user.badges = Array.from(badges);
            await user.save();
            return { plan, vipExpiresAt: expires, badges: user.badges };
        }
        throw e;
    }
    finally {
        session.endSession();
    }
}
async function activateVipFromStripe(userId, planId, paymentIntentId) {
    const plan = wallet_config_1.VIP_PLANS.find((p) => p.id === planId);
    if (!plan)
        throw new WalletServiceError('VIP plan not found.');
    const existing = await wallet_transaction_model_1.default.findOne({
        stripePaymentIntentId: paymentIntentId,
        status: 'completed',
    });
    if (existing)
        return { plan, alreadyProcessed: true };
    const session = await mongoose_1.default.startSession();
    try {
        session.startTransaction();
        await wallet_transaction_model_1.default.create([
            {
                userId,
                type: 'vip_purchase',
                currency: 'usd',
                amount: plan.priceUsdCents / 100,
                diamondsDelta: 0,
                rcoinsDelta: 0,
                diamondsBalance: (await user_model_1.User.findById(userId)).diamonds,
                rcoinsBalance: (await user_model_1.User.findById(userId).select('beanWallet').lean())?.beanWallet ?? 0,
                status: 'completed',
                stripePaymentIntentId: paymentIntentId,
                description: `VIP purchase: ${plan.name}`,
                metadata: { planId, paymentMethod: 'stripe' },
            },
        ], { session });
        const user = await user_model_1.User.findById(userId).session(session);
        if (!user)
            throw new WalletServiceError('User not found.', 404);
        const now = new Date();
        const base = user.vipExpiresAt && user.vipExpiresAt > now ? user.vipExpiresAt : now;
        const expires = new Date(base);
        expires.setDate(expires.getDate() + plan.durationDays);
        user.isVIP = true;
        user.vipFrame = plan.vipFrame;
        user.vipExpiresAt = expires;
        const badges = new Set(user.badges ?? []);
        badges.add(plan.badge);
        user.badges = Array.from(badges);
        await user.save({ session });
        await session.commitTransaction();
        return { plan, vipExpiresAt: expires, badges: user.badges };
    }
    catch (e) {
        await session.abortTransaction().catch(() => undefined);
        if (isMongoTxnUnsupported(e)) {
            const existing2 = await wallet_transaction_model_1.default.findOne({
                stripePaymentIntentId: paymentIntentId,
                status: 'completed',
            });
            if (existing2)
                return { plan, alreadyProcessed: true };
            const userNow = await user_model_1.User.findById(userId);
            if (!userNow)
                throw new WalletServiceError('User not found.', 404);
            await wallet_transaction_model_1.default.create({
                userId,
                type: 'vip_purchase',
                currency: 'usd',
                amount: plan.priceUsdCents / 100,
                diamondsDelta: 0,
                rcoinsDelta: 0,
                diamondsBalance: userNow.diamonds,
                rcoinsBalance: userNow.beanWallet ?? 0,
                status: 'completed',
                stripePaymentIntentId: paymentIntentId,
                description: `VIP purchase: ${plan.name}`,
                metadata: { planId, paymentMethod: 'stripe' },
            });
            const now = new Date();
            const base = userNow.vipExpiresAt && userNow.vipExpiresAt > now ? userNow.vipExpiresAt : now;
            const expires = new Date(base);
            expires.setDate(expires.getDate() + plan.durationDays);
            userNow.isVIP = true;
            userNow.vipFrame = plan.vipFrame;
            userNow.vipExpiresAt = expires;
            const badges = new Set(userNow.badges ?? []);
            badges.add(plan.badge);
            userNow.badges = Array.from(badges);
            await userNow.save();
            return { plan, vipExpiresAt: expires, badges: userNow.badges };
        }
        throw e;
    }
    finally {
        session.endSession();
    }
}
function getPackageById(packageId) {
    return wallet_config_1.DIAMOND_PACKAGES.find((p) => p.id === packageId);
}
function isStripeMockMode() {
    const key = (process.env.STRIPE_SECRET_KEY || '').trim();
    return !key || key.includes('placeholder');
}
async function creditBonusDiamonds(userId, diamonds, type, description) {
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const ledger = await applyBalanceChange(userId, { diamonds }, { type, currency: 'diamonds', amount: diamonds, description }, session);
        await session.commitTransaction();
        return ledger;
    }
    catch (e) {
        await session.abortTransaction();
        throw e;
    }
    finally {
        session.endSession();
    }
}
async function spendVideoCallRcoins(userId, amount) {
    const session = await mongoose_1.default.startSession();
    try {
        session.startTransaction();
        await applyBalanceChange(userId, { rcoins: -amount }, {
            type: 'video_call_spend',
            currency: 'rcoins',
            amount,
            description: 'Video call match fee',
        }, session);
        await session.commitTransaction();
    }
    catch (e) {
        await session.abortTransaction().catch(() => undefined);
        if (isMongoTxnUnsupported(e)) {
            await applyBalanceChangeNoTx(userId, { rcoins: -amount }, {
                type: 'video_call_spend',
                currency: 'rcoins',
                amount,
                description: 'Video call match fee',
            });
            return;
        }
        throw e;
    }
    finally {
        session.endSession();
    }
}
async function spendGiftDiamonds(senderId, diamondCost, giftName, hostId, rcoinEarned) {
    const session = await mongoose_1.default.startSession();
    try {
        session.startTransaction();
        await applyBalanceChange(senderId, { diamonds: -diamondCost }, {
            type: 'gift_spend',
            currency: 'diamonds',
            amount: diamondCost,
            description: `Sent gift: ${giftName}`,
            metadata: { hostId, giftName },
        }, session);
        if (rcoinEarned > 0) {
            await applyBalanceChange(hostId, { rcoins: rcoinEarned }, {
                type: 'gift_earn',
                currency: 'rcoins',
                amount: rcoinEarned,
                description: `Gift earnings: ${giftName}`,
                metadata: { senderId, giftName },
            }, session);
        }
        await session.commitTransaction();
    }
    catch (e) {
        await session.abortTransaction().catch(() => undefined);
        if (isMongoTxnUnsupported(e)) {
            await applyBalanceChangeNoTx(senderId, { diamonds: -diamondCost }, {
                type: 'gift_spend',
                currency: 'diamonds',
                amount: diamondCost,
                description: `Sent gift: ${giftName}`,
                metadata: { hostId, giftName },
            });
            if (rcoinEarned > 0) {
                await applyBalanceChangeNoTx(hostId, { rcoins: rcoinEarned }, {
                    type: 'gift_earn',
                    currency: 'rcoins',
                    amount: rcoinEarned,
                    description: `Gift earnings: ${giftName}`,
                    metadata: { senderId, giftName },
                });
            }
            return;
        }
        throw e;
    }
    finally {
        session.endSession();
    }
}
