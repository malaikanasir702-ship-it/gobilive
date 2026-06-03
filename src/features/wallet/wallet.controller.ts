import { Response } from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import path from 'path';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { User } from '../auth/user.model';
import {
  BADGE_CATALOG,
  DIAMOND_PACKAGES,
  DIAMOND_TO_RCOIN_RATE,
  VIP_PLANS,
} from './wallet.config';
import {
  NotificationPayload,
  NotificationTriggers,
  sendToUser,
} from '../notifications/notification.service';
import {
  activateVipFromStripe,
  activateVipWithDiamonds,
  convertDiamondsToRcoins,
  creditDiamondsPurchase,
  getPackageById,
  getTransactionHistory,
  getWalletBalance,
  isStripeMockMode,
  WalletServiceError,
  withdrawRcoins,
} from './wallet.service';

// wallet.controller is imported early during app boot; ensure env is loaded before using Stripe key.
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const stripeSecretKey = (process.env.STRIPE_SECRET_KEY ?? '').trim();
const stripe = new Stripe(stripeSecretKey || 'sk_test_placeholder');

async function pushWalletNotification(userId: string, payload: NotificationPayload) {
  sendToUser(userId, payload).catch((err) =>
    console.warn('FCM wallet notification failed:', err.message)
  );
}

export const getBalance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const balance = await getWalletBalance(req.user!.id);
    res.status(200).json({ success: true, balance });
  } catch (e: any) {
    res.status(e.status || 500).json({ success: false, message: e.message });
  }
};

export const getTransactions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
    const transactions = await getTransactionHistory(req.user!.id, limit);
    res.status(200).json({ success: true, transactions });
  } catch (e: any) {
    res.status(e.status || 500).json({ success: false, message: e.message });
  }
};

export const getCatalog = async (_req: AuthRequest, res: Response): Promise<void> => {
  res.status(200).json({
    success: true,
    diamondPackages: DIAMOND_PACKAGES,
    vipPlans: VIP_PLANS,
    badges: BADGE_CATALOG,
    conversionRate: DIAMOND_TO_RCOIN_RATE,
    publishableKey: (process.env.STRIPE_PUBLISHABLE_KEY ?? '').trim() || 'pk_test_placeholder',
    stripeMockMode: isStripeMockMode(),
  });
};

export const createPaymentIntent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { packageId, purchaseType = 'diamonds', planId } = req.body;
    const userId = req.user!.id;

    if (purchaseType === 'vip') {
      const plan = VIP_PLANS.find((p) => p.id === planId);
      if (!plan) {
        res.status(400).json({ success: false, message: 'Invalid VIP plan.' });
        return;
      }

      if (isStripeMockMode()) {
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

    const pack = getPackageById(packageId);
    if (!pack) {
      res.status(400).json({ success: false, message: 'Invalid diamond package.' });
      return;
    }

    const totalDiamonds = pack.diamonds + pack.bonusDiamonds;

    if (isStripeMockMode()) {
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
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const confirmPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { paymentIntentId, packageId, purchaseType = 'diamonds', planId } = req.body;
    const userId = req.user!.id;

    if (isStripeMockMode()) {
      if (purchaseType === 'vip' && planId) {
        const result = await activateVipFromStripe(userId, planId, paymentIntentId);
        await pushWalletNotification(userId, NotificationTriggers.vipActivated(result.plan.name));
        const user = await User.findById(userId).select('-passwordHash');
        res.status(200).json({ success: true, message: 'VIP activated (mock).', user, ...result });
        return;
      }

      const pack = getPackageById(packageId);
      if (!pack) {
        res.status(400).json({ success: false, message: 'Invalid package.' });
        return;
      }
      const totalDiamonds = pack.diamonds + pack.bonusDiamonds;
      await creditDiamondsPurchase(userId, totalDiamonds, paymentIntentId, packageId);
      await pushWalletNotification(userId, NotificationTriggers.walletTopUp(totalDiamonds));
      const user = await User.findById(userId).select('-passwordHash');
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
      const result = await activateVipFromStripe(
        userId,
        intent.metadata.planId!,
        paymentIntentId
      );
      await pushWalletNotification(userId, NotificationTriggers.vipActivated(result.plan.name));
      const user = await User.findById(userId).select('-passwordHash');
      res.status(200).json({ success: true, message: 'VIP activated.', user, ...result });
      return;
    }

    const diamonds = parseInt(intent.metadata.diamonds || '0', 10);
    await creditDiamondsPurchase(
      userId,
      diamonds,
      paymentIntentId,
      intent.metadata.packageId || packageId
    );
    await pushWalletNotification(userId, NotificationTriggers.walletTopUp(diamonds));
    const user = await User.findById(userId).select('-passwordHash');
    res.status(200).json({ success: true, message: 'Diamonds credited.', user });
  } catch (e: any) {
    res.status(e.status || 500).json({ success: false, message: e.message });
  }
};

export const convertDiamonds = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { diamondAmount } = req.body;
    const ledger = await convertDiamondsToRcoins(req.user!.id, diamondAmount);
    const user = await User.findById(req.user!.id).select('-passwordHash');
    res.status(200).json({
      success: true,
      message: 'Conversion successful.',
      transaction: ledger,
      user,
    });
  } catch (e: any) {
    const status = e instanceof WalletServiceError ? e.status : 500;
    res.status(status).json({ success: false, message: e.message });
  }
};

export const withdrawRcoinsHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rcoinAmount, payoutMethod, payoutDetails } = req.body;
    const ledger = await withdrawRcoins(
      req.user!.id,
      rcoinAmount,
      payoutMethod || 'bank',
      payoutDetails || ''
    );
    await pushWalletNotification(
      req.user!.id,
      NotificationTriggers.withdrawalSubmitted(rcoinAmount)
    );
    const user = await User.findById(req.user!.id).select('-passwordHash');
    res.status(200).json({
      success: true,
      message: 'Withdrawal submitted for processing.',
      transaction: ledger,
      user,
    });
  } catch (e: any) {
    const status = e instanceof WalletServiceError ? e.status : 500;
    res.status(status).json({ success: false, message: e.message });
  }
};

export const purchaseVipWithDiamonds = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { planId } = req.body;
    const result = await activateVipWithDiamonds(req.user!.id, planId);
    await pushWalletNotification(req.user!.id, NotificationTriggers.vipActivated(result.plan.name));
    const user = await User.findById(req.user!.id).select('-passwordHash');
    res.status(200).json({
      success: true,
      message: 'VIP membership activated.',
      user,
      ...result,
    });
  } catch (e: any) {
    const status = e instanceof WalletServiceError ? e.status : 500;
    res.status(status).json({ success: false, message: e.message });
  }
};

export const stripeWebhook = async (req: AuthRequest, res: Response): Promise<void> => {
  if (isStripeMockMode()) {
    res.status(200).json({ received: true, mock: true });
    return;
  }

  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  try {
    let event: { type: string; data: { object: { id: string; metadata: Record<string, string> } } };
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret) as unknown as typeof event;
    } else {
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
        await activateVipFromStripe(userId, intent.metadata.planId!, intent.id);
      } else {
        const diamonds = parseInt(intent.metadata.diamonds || '0', 10);
        await creditDiamondsPurchase(
          userId,
          diamonds,
          intent.id,
          intent.metadata.packageId || ''
        );
      }
    }

    res.status(200).json({ received: true });
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message });
  }
};
