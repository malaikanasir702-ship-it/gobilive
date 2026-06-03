import { Response } from 'express';
import { Agency } from './agency.model';
import AgencyPayout from './agency-payout.model';
import { AuthRequest } from '../../core/middlewares/auth.middleware';

export const requestPayout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const { amount, method, details } = req.body;
    const agency = await Agency.findOne({ ownerId: req.user.id });
    if (!agency) {
      res.status(404).json({ success: false, message: 'Agency not found.' });
      return;
    }

    if (!amount || amount <= 0) {
      res.status(400).json({ success: false, message: 'Invalid amount.' });
      return;
    }

    if (agency.walletBalance < amount) {
      res.status(400).json({ success: false, message: 'Insufficient agency wallet balance.' });
      return;
    }

    // deduct from agency wallet and create payout record
    agency.walletBalance = Math.max(0, agency.walletBalance - amount);
    await agency.save();

    const payout = await AgencyPayout.create({
      agencyId: agency.id,
      agencyName: agency.name,
      amount,
      method: method || 'bank',
      details: details || '',
      status: 'pending',
    });

    res.status(201).json({ success: true, payout });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyPayouts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const agency = await Agency.findOne({ ownerId: req.user.id });
    if (!agency) {
      res.status(404).json({ success: false, message: 'Agency not found.' });
      return;
    }

    const payouts = await AgencyPayout.find({ agencyId: agency.id }).sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, payouts });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
