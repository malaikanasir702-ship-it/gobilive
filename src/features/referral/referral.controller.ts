import { Response } from 'express';
import { User } from '../auth/user.model';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { logActivity } from '../activity-log/activity-log.service';

/**
 * ─── AD REWARD CONSTANTS ──────────────────────────────────────────────────────
 * 1 Ad Viewed = 5 BEANS ($0.0005)
 * Daily Limit = 20 Ads (100 BEANS / $0.01 max daily)
 * Monthly Limit = 600 Ads (3,000 BEANS / $0.30 max monthly)
 */
export const AD_REWARD_BEANS_PER_AD = 5;
export const AD_REWARD_DAILY_LIMIT = 20;
export const AD_REWARD_MONTHLY_LIMIT = 600;

/**
 * ─── REFERRAL REWARD CONSTANTS ────────────────────────────────────────────────
 * Registration: 2,500 BEANS ($0.25)
 * First Purchase (min $10): 5,000 BEANS ($0.50)
 * 7 Days Active: 2,500 BEANS ($0.25)
 * Total Per Referral: 10,000 BEANS ($1.00)
 */
export const REF_REGISTRATION_BEANS = 2500;
export const REF_FIRST_PURCHASE_BEANS = 5000;
export const REF_7_DAYS_ACTIVE_BEANS = 2500;

// Track ad view counts per user day/month
interface IAdTracker {
  lastAdDate: string; // YYYY-MM-DD
  dailyCount: number;
  lastAdMonth: string; // YYYY-MM
  monthlyCount: number;
}
const adTrackers: Record<string, IAdTracker> = {};

// ─── GET /api/referral/info ───────────────────────────────────────────────────
export const getReferralInfo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const user = await User.findById(req.user.id).select('referralCode referredBy rewardWallet').lean();

    res.status(200).json({
      success: true,
      referralCode: user?.referralCode,
      referredBy: user?.referredBy,
      policy: {
        registrationBeans: REF_REGISTRATION_BEANS,
        firstPurchaseBeans: REF_FIRST_PURCHASE_BEANS,
        active7DaysBeans: REF_7_DAYS_ACTIVE_BEANS,
        totalBeansPerReferral: 10000,
        totalUsdPerReferral: 1.0,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /api/referral/apply ─────────────────────────────────────────────────
export const applyReferralCode = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const user = await User.findById(req.user.id);
    if (!user || user.referredBy) {
      res.status(400).json({ success: false, message: 'Referral code already applied or user not found.' });
      return;
    }

    const referrer = await User.findOne({ referralCode: code.trim().toUpperCase() });
    if (!referrer || referrer.id === user.id) {
      res.status(400).json({ success: false, message: 'Invalid referral code.' });
      return;
    }

    user.referredBy = referrer.referralCode;
    await user.save();

    // Credit Milestone 1: Registration Bonus (2,500 BEANS = $0.25) to Referrer
    await User.findByIdAndUpdate(referrer._id, {
      $inc: { rewardWallet: REF_REGISTRATION_BEANS, beanWallet: REF_REGISTRATION_BEANS },
    });

    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      actionType: 'referral_registered',
      targetEntityType: 'User',
      targetEntityId: referrer._id.toString(),
      description: `User @${user.username} registered with referral code from @${referrer.username}. Credited ${REF_REGISTRATION_BEANS} Beans ($0.25) to referrer.`,
    });

    res.status(200).json({
      success: true,
      message: `Referral code applied! @${referrer.username} earned ${REF_REGISTRATION_BEANS} Beans ($0.25).`,
      referrerUsername: referrer.username,
      beansAwarded: REF_REGISTRATION_BEANS,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /api/referral/claim-ad-reward ──────────────────────────────────────
export const claimAdReward = async (req: AuthRequest, res: Response): Promise<void> => {
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

    if (tracker.dailyCount >= AD_REWARD_DAILY_LIMIT) {
      res.status(400).json({
        success: false,
        message: `Daily limit reached (${AD_REWARD_DAILY_LIMIT} ads/day). Come back tomorrow!`,
        dailyCount: tracker.dailyCount,
        dailyLimit: AD_REWARD_DAILY_LIMIT,
      });
      return;
    }

    if (tracker.monthlyCount >= AD_REWARD_MONTHLY_LIMIT) {
      res.status(400).json({
        success: false,
        message: `Monthly limit reached (${AD_REWARD_MONTHLY_LIMIT} ads/month).`,
        monthlyCount: tracker.monthlyCount,
        monthlyLimit: AD_REWARD_MONTHLY_LIMIT,
      });
      return;
    }

    tracker.dailyCount += 1;
    tracker.monthlyCount += 1;

    // Credit 5 BEANS ($0.0005) to user's rewardWallet
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $inc: { rewardWallet: AD_REWARD_BEANS_PER_AD, beanWallet: AD_REWARD_BEANS_PER_AD } },
      { new: true }
    ).select('rewardWallet beanWallet');

    res.status(200).json({
      success: true,
      beansAwarded: AD_REWARD_BEANS_PER_AD,
      usdValue: 0.0005,
      dailyCount: tracker.dailyCount,
      dailyLimit: AD_REWARD_DAILY_LIMIT,
      monthlyCount: tracker.monthlyCount,
      monthlyLimit: AD_REWARD_MONTHLY_LIMIT,
      rewardWallet: updatedUser?.rewardWallet ?? 0,
      message: `Earned +${AD_REWARD_BEANS_PER_AD} BEANS for watching ad!`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /api/referral/stats ─────────────────────────────────────────────────
export const getReferralStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const user = await User.findById(req.user.id).select('referralCode referredBy');
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    const referredUsers = await User.find({ referredBy: user.referralCode })
      .select('username createdAt rcoins diamonds')
      .lean();

    const totalReferred = referredUsers.length;
    // Each completed referral gives 2,500 beans on registration
    const registrationEarnings = totalReferred * REF_REGISTRATION_BEANS;

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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /api/referral/ad-status ─────────────────────────────────────────────
export const getAdRewardStatus = async (req: AuthRequest, res: Response): Promise<void> => {
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
      beansPerAd: AD_REWARD_BEANS_PER_AD,
      dailyCount,
      dailyLimit: AD_REWARD_DAILY_LIMIT,
      monthlyCount,
      monthlyLimit: AD_REWARD_MONTHLY_LIMIT,
      canWatchMore: dailyCount < AD_REWARD_DAILY_LIMIT && monthlyCount < AD_REWARD_MONTHLY_LIMIT,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
