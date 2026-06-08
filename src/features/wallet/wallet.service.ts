import mongoose from 'mongoose';
import { User } from '../auth/user.model';
import WalletTransaction, {
  IWalletTransaction,
  WalletTxStatus,
  WalletTxType,
} from './wallet.transaction.model';
import {
  DIAMOND_TO_RCOIN_RATE,
  DIAMOND_PACKAGES,
  MIN_CONVERT_DIAMONDS,
  MIN_WITHDRAW_RCOINS,
  VIP_PLANS,
} from './wallet.config';

export class WalletServiceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function isMongoTxnUnsupported(err: any): boolean {
  const msg = String(err?.message ?? err);
  return (
    msg.includes('Transaction numbers are only allowed') ||
    msg.includes('replica set member') ||
    msg.includes('mongos')
  );
}

async function applyBalanceChangeNoTx(
  userId: string,
  deltas: { diamonds?: number; rcoins?: number },
  tx: {
    type: WalletTxType;
    currency: 'diamonds' | 'rcoins' | 'usd';
    amount: number;
    description: string;
    status?: WalletTxStatus;
    stripePaymentIntentId?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<IWalletTransaction> {
  const diamondsDelta = deltas.diamonds ?? 0;
  const rcoinsDelta = deltas.rcoins ?? 0;

  const query: any = { _id: userId };
  if (diamondsDelta < 0) query.diamonds = { $gte: Math.abs(diamondsDelta) };
  if (rcoinsDelta < 0) query.rcoins = { $gte: Math.abs(rcoinsDelta) };

  const updatedUser = await User.findOneAndUpdate(
    query,
    { $inc: { diamonds: diamondsDelta, rcoins: rcoinsDelta } },
    { new: true }
  );

  if (!updatedUser) {
    const exists = await User.findById(userId).select('_id');
    if (!exists) throw new WalletServiceError('User not found.', 404);
    if (diamondsDelta < 0) throw new WalletServiceError('Insufficient diamonds.');
    if (rcoinsDelta < 0) throw new WalletServiceError('Insufficient Beans.');
    throw new WalletServiceError('Balance update failed.');
  }

  const ledger = await WalletTransaction.create({
    userId: updatedUser._id,
    type: tx.type,
    currency: tx.currency,
    amount: tx.amount,
    diamondsDelta,
    rcoinsDelta,
    diamondsBalance: updatedUser.diamonds,
    rcoinsBalance: updatedUser.rcoins,
    status: tx.status ?? 'completed',
    stripePaymentIntentId: tx.stripePaymentIntentId,
    description: tx.description,
    metadata: tx.metadata,
  });

  return ledger;
}

async function applyBalanceChange(
  userId: string,
  deltas: { diamonds?: number; rcoins?: number },
  tx: {
    type: WalletTxType;
    currency: 'diamonds' | 'rcoins' | 'usd';
    amount: number;
    description: string;
    status?: WalletTxStatus;
    stripePaymentIntentId?: string;
    metadata?: Record<string, unknown>;
  },
  session: mongoose.ClientSession
): Promise<IWalletTransaction> {
  // If we don't have a real transaction session (e.g., standalone Mongo), fall back.
  if (!session) {
    return applyBalanceChangeNoTx(userId, deltas, tx);
  }

  const user = await User.findById(userId).session(session);
  if (!user) throw new WalletServiceError('User not found.', 404);

  const diamondsDelta = deltas.diamonds ?? 0;
  const rcoinsDelta = deltas.rcoins ?? 0;

  const newDiamonds = user.diamonds + diamondsDelta;
  const newRcoins = user.rcoins + rcoinsDelta;

  if (newDiamonds < 0) throw new WalletServiceError('Insufficient diamonds.');
  if (newRcoins < 0) throw new WalletServiceError('Insufficient Beans.');

  user.diamonds = newDiamonds;
  user.rcoins = newRcoins;
  await user.save({ session });

  const ledger = await WalletTransaction.create(
    [
      {
        userId: user._id,
        type: tx.type,
        currency: tx.currency,
        amount: tx.amount,
        diamondsDelta,
        rcoinsDelta,
        diamondsBalance: newDiamonds,
        rcoinsBalance: newRcoins,
        status: tx.status ?? 'completed',
        stripePaymentIntentId: tx.stripePaymentIntentId,
        description: tx.description,
        metadata: tx.metadata,
      },
    ],
    { session }
  );

  return ledger[0];
}

export async function getWalletBalance(userId: string) {
  const user = await User.findById(userId).select('diamonds rcoins isVIP vipFrame badges vipExpiresAt');
  if (!user) throw new WalletServiceError('User not found.', 404);

  const isVipActive =
    user.isVIP && (!user.vipExpiresAt || user.vipExpiresAt > new Date());

  return {
    diamonds: user.diamonds,
    rcoins: user.rcoins,
    isVIP: isVipActive,
    vipFrame: user.vipFrame,
    badges: user.badges ?? [],
    vipExpiresAt: user.vipExpiresAt,
  };
}

export async function getTransactionHistory(userId: string, limit = 30) {
  return WalletTransaction.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

export async function creditDiamondsPurchase(
  userId: string,
  diamonds: number,
  stripePaymentIntentId: string,
  packageId: string
) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const existing = await WalletTransaction.findOne({
      stripePaymentIntentId,
      status: 'completed',
    }).session(session);

    if (existing) {
      await session.abortTransaction();
      return existing;
    }

    const ledger = await applyBalanceChange(
      userId,
      { diamonds },
      {
        type: 'purchase_diamonds',
        currency: 'usd',
        amount: diamonds,
        description: `Purchased ${diamonds} diamonds (${packageId})`,
        status: 'completed',
        stripePaymentIntentId,
        metadata: { packageId },
      },
      session
    );

    await session.commitTransaction();
    return ledger;
  } catch (e) {
    await session.abortTransaction().catch(() => undefined);
    if (isMongoTxnUnsupported(e)) {
      const existing = await WalletTransaction.findOne({
        stripePaymentIntentId,
        status: 'completed',
      });
      if (existing) return existing;

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
  } finally {
    session.endSession();
  }
}

export async function convertDiamondsToRcoins(userId: string, diamondAmount: number) {
  if (diamondAmount < MIN_CONVERT_DIAMONDS) {
    throw new WalletServiceError(`Minimum ${MIN_CONVERT_DIAMONDS} diamonds to convert.`);
  }
  if (diamondAmount % DIAMOND_TO_RCOIN_RATE !== 0) {
    throw new WalletServiceError(
      `Diamonds must be a multiple of ${DIAMOND_TO_RCOIN_RATE}.`
    );
  }

  const rcoinsGained = diamondAmount / DIAMOND_TO_RCOIN_RATE;
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const ledger = await applyBalanceChange(
      userId,
      { diamonds: -diamondAmount, rcoins: rcoinsGained },
      {
        type: 'convert_diamonds_to_rcoins',
        currency: 'diamonds',
        amount: diamondAmount,
        description: `Converted ${diamondAmount} diamonds → ${rcoinsGained} Beans`,
        metadata: { rate: DIAMOND_TO_RCOIN_RATE },
      },
      session
    );
    await session.commitTransaction();
    return ledger;
  } catch (e) {
    await session.abortTransaction().catch(() => undefined);
    if (isMongoTxnUnsupported(e)) {
      return await applyBalanceChangeNoTx(userId, { diamonds: -diamondAmount, rcoins: rcoinsGained }, {
        type: 'convert_diamonds_to_rcoins',
        currency: 'diamonds',
        amount: diamondAmount,
        description: `Converted ${diamondAmount} diamonds → ${rcoinsGained} Beans`,
        metadata: { rate: DIAMOND_TO_RCOIN_RATE },
      });
    }
    throw e;
  } finally {
    session.endSession();
  }
}

export async function withdrawRcoins(
  userId: string,
  rcoinAmount: number,
  payoutMethod: string,
  payoutDetails: string
) {
  if (rcoinAmount < MIN_WITHDRAW_RCOINS) {
    throw new WalletServiceError(`Minimum withdrawal is ${MIN_WITHDRAW_RCOINS} Beans.`);
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const ledger = await applyBalanceChange(
      userId,
      { rcoins: -rcoinAmount },
      {
        type: 'withdraw_rcoins',
        currency: 'rcoins',
        amount: rcoinAmount,
        description: `Withdrawal request: ${rcoinAmount} Beans`,
        status: 'pending',
        metadata: { payoutMethod, payoutDetails },
      },
      session
    );
    await session.commitTransaction();
    return ledger;
  } catch (e) {
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
  } finally {
    session.endSession();
  }
}

export async function activateVipWithDiamonds(userId: string, planId: string) {
  const plan = VIP_PLANS.find((p) => p.id === planId);
  if (!plan) throw new WalletServiceError('VIP plan not found.');

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    await applyBalanceChange(
      userId,
      { diamonds: -plan.diamondPrice },
      {
        type: 'vip_purchase',
        currency: 'diamonds',
        amount: plan.diamondPrice,
        description: `VIP purchase: ${plan.name}`,
        metadata: { planId, paymentMethod: 'diamonds' },
      },
      session
    );

    const user = await User.findById(userId).session(session);
    if (!user) throw new WalletServiceError('User not found.', 404);

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
  } catch (e) {
    await session.abortTransaction().catch(() => undefined);
    if (isMongoTxnUnsupported(e)) {
      await applyBalanceChangeNoTx(userId, { diamonds: -plan.diamondPrice }, {
        type: 'vip_purchase',
        currency: 'diamonds',
        amount: plan.diamondPrice,
        description: `VIP purchase: ${plan.name}`,
        metadata: { planId, paymentMethod: 'diamonds' },
      });

      const user = await User.findById(userId);
      if (!user) throw new WalletServiceError('User not found.', 404);

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
  } finally {
    session.endSession();
  }
}

export async function activateVipFromStripe(userId: string, planId: string, paymentIntentId: string) {
  const plan = VIP_PLANS.find((p) => p.id === planId);
  if (!plan) throw new WalletServiceError('VIP plan not found.');

  const existing = await WalletTransaction.findOne({
    stripePaymentIntentId: paymentIntentId,
    status: 'completed',
  });
  if (existing) return { plan, alreadyProcessed: true };

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    await WalletTransaction.create(
      [
        {
          userId,
          type: 'vip_purchase',
          currency: 'usd',
          amount: plan.priceUsdCents / 100,
          diamondsDelta: 0,
          rcoinsDelta: 0,
          diamondsBalance: (await User.findById(userId))!.diamonds,
          rcoinsBalance: (await User.findById(userId))!.rcoins,
          status: 'completed',
          stripePaymentIntentId: paymentIntentId,
          description: `VIP purchase: ${plan.name}`,
          metadata: { planId, paymentMethod: 'stripe' },
        },
      ],
      { session }
    );

    const user = await User.findById(userId).session(session);
    if (!user) throw new WalletServiceError('User not found.', 404);

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
  } catch (e) {
    await session.abortTransaction().catch(() => undefined);
    if (isMongoTxnUnsupported(e)) {
      const existing2 = await WalletTransaction.findOne({
        stripePaymentIntentId: paymentIntentId,
        status: 'completed',
      });
      if (existing2) return { plan, alreadyProcessed: true };

      const userNow = await User.findById(userId);
      if (!userNow) throw new WalletServiceError('User not found.', 404);

      await WalletTransaction.create({
        userId,
        type: 'vip_purchase',
        currency: 'usd',
        amount: plan.priceUsdCents / 100,
        diamondsDelta: 0,
        rcoinsDelta: 0,
        diamondsBalance: userNow.diamonds,
        rcoinsBalance: userNow.rcoins,
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
  } finally {
    session.endSession();
  }
}

export function getPackageById(packageId: string) {
  return DIAMOND_PACKAGES.find((p) => p.id === packageId);
}

export function isStripeMockMode(): boolean {
  const key = (process.env.STRIPE_SECRET_KEY || '').trim();
  return !key || key.includes('placeholder');
}

export async function creditBonusDiamonds(
  userId: string,
  diamonds: number,
  type: 'referral_bonus' | 'daily_reward' | 'ad_reward',
  description: string
) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const ledger = await applyBalanceChange(
      userId,
      { diamonds },
      { type, currency: 'diamonds', amount: diamonds, description },
      session
    );
    await session.commitTransaction();
    return ledger;
  } catch (e) {
    await session.abortTransaction();
    throw e;
  } finally {
    session.endSession();
  }
}

export async function spendVideoCallRcoins(userId: string, amount: number) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    await applyBalanceChange(
      userId,
      { rcoins: -amount },
      {
        type: 'video_call_spend',
        currency: 'rcoins',
        amount,
        description: 'Video call match fee',
      },
      session
    );
    await session.commitTransaction();
  } catch (e) {
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
  } finally {
    session.endSession();
  }
}

export async function spendGiftDiamonds(
  senderId: string,
  diamondCost: number,
  giftName: string,
  hostId: string,
  rcoinEarned: number
) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    await applyBalanceChange(
      senderId,
      { diamonds: -diamondCost },
      {
        type: 'gift_spend',
        currency: 'diamonds',
        amount: diamondCost,
        description: `Sent gift: ${giftName}`,
        metadata: { hostId, giftName },
      },
      session
    );

    if (rcoinEarned > 0) {
      await applyBalanceChange(
        hostId,
        { rcoins: rcoinEarned },
        {
          type: 'gift_earn',
          currency: 'rcoins',
          amount: rcoinEarned,
          description: `Gift earnings: ${giftName}`,
          metadata: { senderId, giftName },
        },
        session
      );
    }

    await session.commitTransaction();
  } catch (e) {
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
  } finally {
    session.endSession();
  }
}
