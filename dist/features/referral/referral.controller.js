"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReferralStats = exports.getDailyRewardStatus = exports.claimAdReward = exports.claimDailyReward = exports.applyReferralCode = exports.getReferralInfo = void 0;
const user_model_1 = require("../auth/user.model");
const platform_settings_model_1 = require("../settings/platform-settings.model");
const wallet_service_1 = require("../wallet/wallet.service");
const getReferralInfo = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const user = await user_model_1.User.findById(req.user.id).select('referralCode referredBy');
        const settings = await (0, platform_settings_model_1.getPlatformSettings)();
        res.status(200).json({
            success: true,
            referralCode: user?.referralCode,
            referredBy: user?.referredBy,
            bonusDiamonds: settings.referralBonusDiamonds,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getReferralInfo = getReferralInfo;
const applyReferralCode = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const { code } = req.body;
        const settings = await (0, platform_settings_model_1.getPlatformSettings)();
        const user = await user_model_1.User.findById(req.user.id);
        if (!user || user.referredBy) {
            res.status(400).json({ success: false, message: 'Referral already applied or user not found.' });
            return;
        }
        const referrer = await user_model_1.User.findOne({ referralCode: code });
        if (!referrer || referrer.id === user.id) {
            res.status(400).json({ success: false, message: 'Invalid referral code.' });
            return;
        }
        user.referredBy = referrer.referralCode;
        await user.save();
        await (0, wallet_service_1.creditBonusDiamonds)(user.id, settings.referralBonusDiamonds, 'referral_bonus', `Referral bonus from ${referrer.username}`);
        await (0, wallet_service_1.creditBonusDiamonds)(referrer.id, Math.floor(settings.referralBonusDiamonds / 2), 'referral_bonus', `Referral reward — ${user.username} joined`);
        res.status(200).json({
            success: true,
            message: `You earned ${settings.referralBonusDiamonds} diamonds!`,
            diamondsAwarded: settings.referralBonusDiamonds,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.applyReferralCode = applyReferralCode;
const claimDailyReward = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const settings = await (0, platform_settings_model_1.getPlatformSettings)();
        const user = await user_model_1.User.findById(req.user.id);
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        const now = new Date();
        if (user.lastDailyRewardAt) {
            const last = new Date(user.lastDailyRewardAt);
            const hoursSince = (now.getTime() - last.getTime()) / (1000 * 60 * 60);
            if (hoursSince < 24) {
                res.status(400).json({
                    success: false,
                    message: 'Daily reward already claimed. Come back tomorrow.',
                    nextClaimInHours: Math.ceil(24 - hoursSince),
                });
                return;
            }
        }
        user.lastDailyRewardAt = now;
        await user.save();
        await (0, wallet_service_1.creditBonusDiamonds)(user.id, settings.dailyLoginDiamonds, 'daily_reward', 'Daily login reward');
        res.status(200).json({
            success: true,
            diamondsAwarded: settings.dailyLoginDiamonds,
            message: `Daily reward: +${settings.dailyLoginDiamonds} diamonds`,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.claimDailyReward = claimDailyReward;
const claimAdReward = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const diamonds = 10;
        await (0, wallet_service_1.creditBonusDiamonds)(req.user.id, diamonds, 'ad_reward', 'Watched ad reward');
        res.status(200).json({ success: true, diamondsAwarded: diamonds });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.claimAdReward = claimAdReward;
const getDailyRewardStatus = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const settings = await (0, platform_settings_model_1.getPlatformSettings)();
        const user = await user_model_1.User.findById(req.user.id).select('lastDailyRewardAt');
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        const now = new Date();
        let canClaim = true;
        let nextClaimAt = null;
        let hoursUntilNext = 0;
        if (user.lastDailyRewardAt) {
            const last = new Date(user.lastDailyRewardAt);
            const hoursSince = (now.getTime() - last.getTime()) / (1000 * 60 * 60);
            if (hoursSince < 24) {
                canClaim = false;
                hoursUntilNext = 24 - hoursSince;
                nextClaimAt = new Date(last.getTime() + 24 * 60 * 60 * 1000);
            }
        }
        res.status(200).json({
            success: true,
            canClaim,
            diamondsReward: settings.dailyLoginDiamonds,
            nextClaimAt: nextClaimAt?.toISOString() || null,
            hoursUntilNext: Math.ceil(hoursUntilNext),
            lastClaimedAt: user.lastDailyRewardAt?.toISOString() || null,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getDailyRewardStatus = getDailyRewardStatus;
const getReferralStats = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const user = await user_model_1.User.findById(req.user.id).select('referralCode referredBy');
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        // Count how many users this user has referred
        const referredCount = await user_model_1.User.countDocuments({ referredBy: user.referralCode });
        // Get referral earnings from wallet transactions
        const WalletTransaction = require('../wallet/wallet.transaction.model').WalletTransaction;
        const referralTransactions = await WalletTransaction.find({
            userId: req.user.id,
            type: 'referral_bonus',
        });
        const referralEarnings = referralTransactions.reduce((sum, tx) => sum + (tx.diamondsDelta || 0), 0);
        res.status(200).json({
            success: true,
            referralCode: user.referralCode,
            referredBy: user.referredBy || null,
            referredCount,
            referralEarnings,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getReferralStats = getReferralStats;
