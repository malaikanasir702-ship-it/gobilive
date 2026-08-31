"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdRewardStatus = exports.getReferralStats = exports.claimAdReward = exports.applyReferralCode = exports.getReferralInfo = exports.REF_7_DAYS_ACTIVE_BEANS = exports.REF_FIRST_PURCHASE_BEANS = exports.REF_REGISTRATION_BEANS = exports.AD_REWARD_MONTHLY_LIMIT = exports.AD_REWARD_DAILY_LIMIT = exports.AD_REWARD_BEANS_PER_AD = void 0;
const user_model_1 = require("../auth/user.model");
const activity_log_service_1 = require("../activity-log/activity-log.service");
/**
 * ─── AD REWARD CONSTANTS ──────────────────────────────────────────────────────
 * 1 Ad Viewed = 5 BEANS ($0.0005)
 * Daily Limit = 20 Ads (100 BEANS / $0.01 max daily)
 * Monthly Limit = 600 Ads (3,000 BEANS / $0.30 max monthly)
 */
exports.AD_REWARD_BEANS_PER_AD = 5;
exports.AD_REWARD_DAILY_LIMIT = 20;
exports.AD_REWARD_MONTHLY_LIMIT = 600;
/**
 * ─── REFERRAL REWARD CONSTANTS ────────────────────────────────────────────────
 * Registration: 2,500 BEANS ($0.25)
 * First Purchase (min $10): 5,000 BEANS ($0.50)
 * 7 Days Active: 2,500 BEANS ($0.25)
 * Total Per Referral: 10,000 BEANS ($1.00)
 */
exports.REF_REGISTRATION_BEANS = 2500;
exports.REF_FIRST_PURCHASE_BEANS = 5000;
exports.REF_7_DAYS_ACTIVE_BEANS = 2500;
const adTrackers = {};
// ─── GET /api/referral/info ───────────────────────────────────────────────────
const getReferralInfo = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const user = await user_model_1.User.findById(req.user.id).select('referralCode referredBy rewardWallet').lean();
        res.status(200).json({
            success: true,
            referralCode: user?.referralCode,
            referredBy: user?.referredBy,
            policy: {
                registrationBeans: exports.REF_REGISTRATION_BEANS,
                firstPurchaseBeans: exports.REF_FIRST_PURCHASE_BEANS,
                active7DaysBeans: exports.REF_7_DAYS_ACTIVE_BEANS,
                totalBeansPerReferral: 10000,
                totalUsdPerReferral: 1.0,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getReferralInfo = getReferralInfo;
// ─── POST /api/referral/apply ─────────────────────────────────────────────────
const applyReferralCode = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const { code } = req.body;
        if (!code) {
            res.status(400).json({ success: false, message: 'Referral code is required.' });
            return;
        }
        const user = await user_model_1.User.findById(req.user.id);
        if (!user || user.referredBy) {
            res.status(400).json({ success: false, message: 'Referral code already applied or user not found.' });
            return;
        }
        const referrer = await user_model_1.User.findOne({ referralCode: code.trim().toUpperCase() });
        if (!referrer || referrer.id === user.id) {
            res.status(400).json({ success: false, message: 'Invalid referral code.' });
            return;
        }
        user.referredBy = referrer.referralCode;
        await user.save();
        // Credit Milestone 1: Registration Bonus (2,500 BEANS = $0.25) to Referrer
        await user_model_1.User.findByIdAndUpdate(referrer._id, {
            $inc: { rewardWallet: exports.REF_REGISTRATION_BEANS, beanWallet: exports.REF_REGISTRATION_BEANS },
        });
        await (0, activity_log_service_1.logActivity)({
            actorId: user.id,
            actorRole: user.role,
            actionType: 'referral_registered',
            targetEntityType: 'User',
            targetEntityId: referrer._id.toString(),
            description: `User @${user.username} registered with referral code from @${referrer.username}. Credited ${exports.REF_REGISTRATION_BEANS} Beans ($0.25) to referrer.`,
        });
        res.status(200).json({
            success: true,
            message: `Referral code applied! @${referrer.username} earned ${exports.REF_REGISTRATION_BEANS} Beans ($0.25).`,
            referrerUsername: referrer.username,
            beansAwarded: exports.REF_REGISTRATION_BEANS,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.applyReferralCode = applyReferralCode;
// ─── POST /api/referral/claim-ad-reward ──────────────────────────────────────
const claimAdReward = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const userId = req.user.id;
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);
        const monthStr = todayStr.slice(0, 7);
        if (!adTrackers[userId]) {
            adTrackers[userId] = { lastAdDate: todayStr, dailyCount: 0, lastAdMonth: monthStr, monthlyCount: 0 };
        }
        const tracker = adTrackers[userId];
        if (tracker.lastAdDate !== todayStr) {
            tracker.lastAdDate = todayStr;
            tracker.dailyCount = 0;
        }
        if (tracker.lastAdMonth !== monthStr) {
            tracker.lastAdMonth = monthStr;
            tracker.monthlyCount = 0;
        }
        if (tracker.dailyCount >= exports.AD_REWARD_DAILY_LIMIT) {
            res.status(400).json({
                success: false,
                message: `Daily limit reached (${exports.AD_REWARD_DAILY_LIMIT} ads/day). Come back tomorrow!`,
                dailyCount: tracker.dailyCount,
                dailyLimit: exports.AD_REWARD_DAILY_LIMIT,
            });
            return;
        }
        if (tracker.monthlyCount >= exports.AD_REWARD_MONTHLY_LIMIT) {
            res.status(400).json({
                success: false,
                message: `Monthly limit reached (${exports.AD_REWARD_MONTHLY_LIMIT} ads/month).`,
                monthlyCount: tracker.monthlyCount,
                monthlyLimit: exports.AD_REWARD_MONTHLY_LIMIT,
            });
            return;
        }
        tracker.dailyCount += 1;
        tracker.monthlyCount += 1;
        // Credit 5 BEANS ($0.0005) to user's rewardWallet
        const updatedUser = await user_model_1.User.findByIdAndUpdate(userId, { $inc: { rewardWallet: exports.AD_REWARD_BEANS_PER_AD, beanWallet: exports.AD_REWARD_BEANS_PER_AD } }, { new: true }).select('rewardWallet beanWallet');
        res.status(200).json({
            success: true,
            beansAwarded: exports.AD_REWARD_BEANS_PER_AD,
            usdValue: 0.0005,
            dailyCount: tracker.dailyCount,
            dailyLimit: exports.AD_REWARD_DAILY_LIMIT,
            monthlyCount: tracker.monthlyCount,
            monthlyLimit: exports.AD_REWARD_MONTHLY_LIMIT,
            rewardWallet: updatedUser?.rewardWallet ?? 0,
            message: `Earned +${exports.AD_REWARD_BEANS_PER_AD} BEANS for watching ad!`,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.claimAdReward = claimAdReward;
// ─── GET /api/referral/stats ─────────────────────────────────────────────────
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
        const referredUsers = await user_model_1.User.find({ referredBy: user.referralCode })
            .select('username createdAt rcoins diamonds')
            .lean();
        const totalReferred = referredUsers.length;
        // Each completed referral gives 2,500 beans on registration
        const registrationEarnings = totalReferred * exports.REF_REGISTRATION_BEANS;
        res.status(200).json({
            success: true,
            referralCode: user.referralCode,
            referredBy: user.referredBy || null,
            totalReferred,
            totalBeansEarned: registrationEarnings,
            totalUsdEarned: (registrationEarnings / 10000).toFixed(2),
            referredUsers: referredUsers.map(u => ({
                username: u.username,
                joinedAt: u.createdAt,
            })),
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getReferralStats = getReferralStats;
// ─── GET /api/referral/ad-status ─────────────────────────────────────────────
const getAdRewardStatus = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const userId = req.user.id;
        const todayStr = new Date().toISOString().slice(0, 10);
        const monthStr = todayStr.slice(0, 7);
        const tracker = adTrackers[userId] || { lastAdDate: todayStr, dailyCount: 0, lastAdMonth: monthStr, monthlyCount: 0 };
        const dailyCount = tracker.lastAdDate === todayStr ? tracker.dailyCount : 0;
        const monthlyCount = tracker.lastAdMonth === monthStr ? tracker.monthlyCount : 0;
        res.status(200).json({
            success: true,
            beansPerAd: exports.AD_REWARD_BEANS_PER_AD,
            dailyCount,
            dailyLimit: exports.AD_REWARD_DAILY_LIMIT,
            monthlyCount,
            monthlyLimit: exports.AD_REWARD_MONTHLY_LIMIT,
            canWatchMore: dailyCount < exports.AD_REWARD_DAILY_LIMIT && monthlyCount < exports.AD_REWARD_MONTHLY_LIMIT,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getAdRewardStatus = getAdRewardStatus;
