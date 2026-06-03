import { Response } from 'express';
import { CoinSeller } from './coin-seller.model';
import CoinSellerSale from './coin-seller.sale.model';
import { User } from '../auth/user.model';
import { AuthRequest } from '../../core/middlewares/auth.middleware';

export const applyAsCoinSeller = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const { businessName } = req.body;
    const existing = await CoinSeller.findOne({ userId: req.user.id });
    if (existing) {
      res.status(400).json({ success: false, message: 'Application already submitted.' });
      return;
    }

    const user = await User.findById(req.user.id);
    const seller = await CoinSeller.create({
      userId: req.user.id,
      username: user?.username,
      businessName,
      isApproved: false,
    });

    res.status(201).json({ success: true, seller, message: 'Application submitted for admin approval.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyCoinSellerProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const seller = await CoinSeller.findOne({ userId: req.user.id });
    res.status(200).json({ success: true, seller });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const recordSale = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const { diamonds, revenueUsd } = req.body;
    if (!diamonds || !revenueUsd) {
      res.status(400).json({ success: false, message: 'Invalid sale data.' });
      return;
    }

    const seller = await CoinSeller.findOne({ userId: req.user.id });
    if (!seller || !seller.isApproved) {
      res.status(403).json({ success: false, message: 'Not an approved coin seller.' });
      return;
    }

    seller.diamondsSold = (seller.diamondsSold || 0) + Number(diamonds);
    seller.totalRevenue = (seller.totalRevenue || 0) + Number(revenueUsd);
    await seller.save();

    const sale = await CoinSellerSale.create({
      sellerId: seller.userId,
      sellerUsername: seller.username,
      diamonds: Number(diamonds),
      revenueUsd: Number(revenueUsd),
    });

    res.status(201).json({ success: true, sale, seller });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMySales = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const sales = await CoinSellerSale.find({ sellerId: req.user.id }).sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, sales });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
