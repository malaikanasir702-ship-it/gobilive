import { Response } from 'express';
import { User } from '../auth/user.model';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { getPlatformSettings } from '../settings/platform-settings.model';
import { creditBonusDiamonds } from '../wallet/wallet.service';

export const getReferralInfo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const user = await User.findById(req.user.id).select('referralCode referredBy');
    const settings = await getPlatformSettings();

    res.status(200).json({
      success: true,
      referralCode: user?.referralCode,
      referredBy: user?.referredBy,
      bonusDiamonds: settings.referralBonusDiamonds,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const applyReferralCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const { code } = req.body;
    const settings = await getPlatformSettings();
    const user = await User.findById(req.user.id);

    if (!user || user.referredBy) {
      res.status(400).json({ success: false, message: 'Referral already applied or user not found.' });
      return;
    }

    const referrer = await User.findOne({ referralCode: code });
    if (!referrer || referrer.id === user.id) {
      res.status(400).json({ success: false, message: 'Invalid referral code.' });
      return;
    }

    user.referredBy = referrer.referralCode;
    await user.save();

    await creditBonusDiamonds(
      user.id,
      settings.referralBonusDiamonds,
      'referral_bonus',
      `Referral bonus from ${referrer.username}`
    );
    await creditBonusDiamonds(
      referrer.id,
      Math.floor(settings.referralBonusDiamonds / 2),
      'referral_bonus',
      `Referral reward — ${user.username} joined`
    );

    res.status(200).json({
      success: true,
      message: `You earned ${settings.referralBonusDiamonds} diamonds!`,
      diamondsAwarded: settings.referralBonusDiamonds,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const claimDailyReward = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const settings = await getPlatformSettings();
    const user = await User.findById(req.user.id);
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

    await creditBonusDiamonds(
      user.id,
      settings.dailyLoginDiamonds,
      'daily_reward',
      'Daily login reward'
    );

    res.status(200).json({
      success: true,
      diamondsAwarded: settings.dailyLoginDiamonds,
      message: `Daily reward: +${settings.dailyLoginDiamonds} diamonds`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const claimAdReward = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const diamonds = 10;
    await creditBonusDiamonds(req.user.id, diamonds, 'ad_reward', 'Watched ad reward');
    res.status(200).json({ success: true, diamondsAwarded: diamonds });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDailyRewardStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const settings = await getPlatformSettings();
    const user = await User.findById(req.user.id).select('lastDailyRewardAt');
    
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    const now = new Date();
    let canClaim = true;
    let nextClaimAt: Date | null = null;
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

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

    // Count how many users this user has referred
    const referredCount = await User.countDocuments({ referredBy: user.referralCode });

    // Get referral earnings from wallet transactions
    const WalletTransaction = require('../wallet/wallet.transaction.model').WalletTransaction;
    const referralTransactions = await WalletTransaction.find({
      userId: req.user.id,
      type: 'referral_bonus',
    });
    
    const referralEarnings = referralTransactions.reduce((sum: number, tx: any) => sum + (tx.diamondsDelta || 0), 0);

    res.status(200).json({
      success: true,
      referralCode: user.referralCode,
      referredBy: user.referredBy || null,
      referredCount,
      referralEarnings,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
