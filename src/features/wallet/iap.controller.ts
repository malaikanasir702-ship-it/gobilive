import { Response } from 'express';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { DIAMOND_PACKAGES } from './wallet.config';
import { creditDiamondsPurchase } from './wallet.service';
import WalletTransaction from './wallet.transaction.model';

export const verifyGooglePlayPurchase = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const { packageId, purchaseToken, productId, orderId } = req.body;
    const pack = DIAMOND_PACKAGES.find((p) => p.id === packageId || p.id === productId);
    if (!pack) {
      res.status(400).json({ success: false, message: 'Unknown package.' });
      return;
    }

    const tokenKey = purchaseToken || orderId;
    if (!tokenKey) {
      res.status(400).json({ success: false, message: 'purchaseToken or orderId required.' });
      return;
    }

    const existing = await WalletTransaction.findOne({
      'metadata.purchaseToken': tokenKey,
      status: 'completed',
    });
    if (existing) {
      res.status(200).json({ success: true, message: 'Already credited.', duplicate: true });
      return;
    }

    const totalDiamonds = pack.diamonds + pack.bonusDiamonds;
    await creditDiamondsPurchase(
      req.user.id,
      totalDiamonds,
      `iap_${tokenKey}`,
      pack.id
    );

    await WalletTransaction.findOneAndUpdate(
      { stripePaymentIntentId: `iap_${tokenKey}` },
      { $set: { 'metadata.purchaseToken': tokenKey, 'metadata.platform': 'google_play' } }
    );

    res.status(200).json({
      success: true,
      diamonds: totalDiamonds,
      message: `${totalDiamonds} diamonds added to your wallet.`,
    });
  } catch (error: any) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'IAP verification failed.',
    });
  }
};
