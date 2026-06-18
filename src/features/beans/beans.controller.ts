import { Response } from 'express';
import mongoose from 'mongoose';
import { User } from '../auth/user.model';
import { BeanTransaction } from './bean-transaction.model';
import { PolicyLog } from '../policy/policy-log.model';
import { getPlatformSettings } from '../settings/platform-settings.model';
import { logActivity } from '../activity-log/activity-log.service';
import { AdminAuthRequest } from '../../core/middlewares/rbac.middleware';

// ─── Bean Wallet ─────────────────────────────────────────────────────────────

export const getBeanWallet = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.adminUser!.id).select('beanWallet').lean();
    res.status(200).json({ success: true, beanWallet: user?.beanWallet ?? 0 });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Generate Beans ───────────────────────────────────────────────────────────

export const generateBeans = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      res.status(400).json({ success: false, message: 'Amount must be a positive number.' });
      return;
    }

    const admin = await User.findByIdAndUpdate(
      req.adminUser!.id,
      { $inc: { beanWallet: amount } },
      { new: true, session }
    ).select('beanWallet');

    await BeanTransaction.create(
      [
        {
          type: 'generate',
          toId: req.adminUser!.id,
          toRole: 'company_admin',
          amount,
          status: 'completed',
          note: `Generated ${amount} beans`,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    await logActivity({
      actorId: req.adminUser!.id,
      actorRole: req.adminUser!.role,
      actionType: 'generate_beans',
      targetEntityType: 'User',
      targetEntityId: req.adminUser!.id,
      description: `Generated ${amount} beans. New wallet balance: ${admin?.beanWallet}`,
    });

    res.status(200).json({ success: true, beanWallet: admin?.beanWallet, generated: amount });
  } catch (error: any) {
    await session.abortTransaction();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

// ─── Assign Beans ─────────────────────────────────────────────────────────────

export const assignBeans = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { recipientId, email, amount, transferSlipUrl } = req.body;
    if (!amount || amount <= 0) {
      res.status(400).json({ success: false, message: 'Amount must be a positive number.' });
      return;
    }

    const query = recipientId ? { _id: recipientId } : { email: email?.toLowerCase() };
    const recipient = await User.findOne(query).select('role beanWallet username').session(session);

    if (!recipient) {
      res.status(404).json({ success: false, message: 'Recipient not found.' });
      return;
    }

    if (!['top_up_agent', 'reseller'].includes(recipient.role)) {
      res.status(400).json({
        success: false,
        message: 'Beans can only be assigned to Top Up Agents or Resellers.',
      });
      return;
    }

    const admin = await User.findById(req.adminUser!.id).select('beanWallet').session(session);
    if (!admin || admin.beanWallet < amount) {
      res.status(400).json({ success: false, message: 'Insufficient bean wallet balance.' });
      return;
    }

    await User.findByIdAndUpdate(req.adminUser!.id, { $inc: { beanWallet: -amount } }, { session });
    await User.findByIdAndUpdate(recipient._id, { $inc: { beanWallet: amount } }, { session });

    await BeanTransaction.create(
      [
        {
          type: 'assign',
          fromId: req.adminUser!.id,
          fromRole: 'company_admin',
          toId: recipient._id,
          toRole: recipient.role,
          amount,
          transferSlipUrl,
          status: 'completed',
          note: `Assigned by company admin`,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    await logActivity({
      actorId: req.adminUser!.id,
      actorRole: req.adminUser!.role,
      actionType: 'assign_beans',
      targetEntityType: 'User',
      targetEntityId: recipient._id.toString(),
      description: `Assigned ${amount} beans to ${recipient.username} (${recipient.role})`,
    });

    res.status(200).json({ success: true, assigned: amount, recipientUsername: recipient.username });
  } catch (error: any) {
    await session.abortTransaction();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

// ─── Bean Dollar Rate ─────────────────────────────────────────────────────────

export const getBeanDollarRate = async (_req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const settings = await getPlatformSettings();
    res.status(200).json({
      success: true,
      beanDollarRateUsd: settings.beanDollarRateUsd,
      beanDollarRateBeans: settings.beanDollarRateBeans,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateBeanDollarRate = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { usd, beans } = req.body;
    if (!usd || !beans || usd <= 0 || beans <= 0) {
      res.status(400).json({ success: false, message: 'USD amount and Bean amount must be positive.' });
      return;
    }

    const settings = await getPlatformSettings();
    const prev = { usd: settings.beanDollarRateUsd, beans: settings.beanDollarRateBeans };

    settings.beanDollarRateUsd = usd;
    settings.beanDollarRateBeans = beans;
    await settings.save();

    await PolicyLog.create({
      policyName: 'bean_dollar_rate',
      previousValue: prev,
      newValue: { usd, beans },
      changedBy: req.adminUser!.id,
    });

    res.status(200).json({ success: true, beanDollarRateUsd: usd, beanDollarRateBeans: beans });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Diamond to Bean Commission ───────────────────────────────────────────────

export const getD2BCommission = async (_req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const settings = await getPlatformSettings();
    res.status(200).json({ success: true, diamondToBeanCommission: settings.diamondToBeanCommission });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateD2BCommission = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { commission } = req.body;
    if (commission === undefined || commission < 0 || commission > 100) {
      res.status(400).json({ success: false, message: 'Commission must be between 0 and 100.' });
      return;
    }

    const settings = await getPlatformSettings();
    const prev = settings.diamondToBeanCommission;
    settings.diamondToBeanCommission = commission;
    await settings.save();

    await PolicyLog.create({
      policyName: 'diamond_to_bean_commission',
      previousValue: prev,
      newValue: commission,
      changedBy: req.adminUser!.id,
    });

    res.status(200).json({ success: true, diamondToBeanCommission: commission });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Diamond to Bean Rate ─────────────────────────────────────────────────────

export const getD2BRate = async (_req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const settings = await getPlatformSettings();
    res.status(200).json({ success: true, diamondToBeanRate: settings.diamondToBeanRate });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateD2BRate = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { rate } = req.body;
    if (!rate || rate <= 0) {
      res.status(400).json({ success: false, message: 'Rate must be a positive number.' });
      return;
    }

    const settings = await getPlatformSettings();
    const prev = settings.diamondToBeanRate;
    settings.diamondToBeanRate = rate;
    await settings.save();

    await PolicyLog.create({
      policyName: 'diamond_to_bean_rate',
      previousValue: prev,
      newValue: rate,
      changedBy: req.adminUser!.id,
    });

    res.status(200).json({ success: true, diamondToBeanRate: rate });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Dollar Conversion Rates ──────────────────────────────────────────────────

// Stored in a separate collection via PolicyLog with policyName 'dollar_conversion_rate'
// and countryCode field. We maintain the live rates in a simple document.
import { DollarConversionRate } from './dollar-conversion-rate.model';

export const getDollarConversionRates = async (_req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const rates = await DollarConversionRate.find().lean();
    res.status(200).json({ success: true, rates });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateDollarConversionRate = async (
  req: AdminAuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { countryCode, countryName, rate } = req.body;
    if (!countryCode || !rate || rate <= 0) {
      res.status(400).json({ success: false, message: 'countryCode and rate are required.' });
      return;
    }

    const existing = await DollarConversionRate.findOne({ countryCode: countryCode.toUpperCase() });
    const prev = existing?.rate ?? null;

    await DollarConversionRate.findOneAndUpdate(
      { countryCode: countryCode.toUpperCase() },
      { countryCode: countryCode.toUpperCase(), countryName, rate },
      { upsert: true, new: true }
    );

    await PolicyLog.create({
      policyName: 'dollar_conversion_rate',
      previousValue: prev,
      newValue: rate,
      changedBy: req.adminUser!.id,
      countryCode: countryCode.toUpperCase(),
    });

    res.status(200).json({ success: true, countryCode, rate });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Bean Logs (tabbed) ───────────────────────────────────────────────────────

export const getBeanLogs = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const tab = (req.query.tab as string) || 'assigned_beans';
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
    const skip = (page - 1) * limit;

    let data: any[] = [];
    let total = 0;

    const policyTabs: Record<string, string> = {
      bean_dollar_rate: 'bean_dollar_rate',
      d2b_rate: 'diamond_to_bean_rate',
      d2b_commission: 'diamond_to_bean_commission',
      dollar_conversion: 'dollar_conversion_rate',
    };

    if (tab === 'assigned_beans') {
      total = await BeanTransaction.countDocuments({ type: 'assign' });
      data = await BeanTransaction.find({ type: 'assign' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('fromId', 'username')
        .populate('toId', 'username role')
        .lean();
    } else if (tab === 'generated_beans') {
      total = await BeanTransaction.countDocuments({ type: 'generate' });
      data = await BeanTransaction.find({ type: 'generate' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('fromId', 'username role')
        .populate('toId', 'username role')
        .lean();
    } else if (policyTabs[tab]) {
      total = await PolicyLog.countDocuments({ policyName: policyTabs[tab] });
      data = await PolicyLog.find({ policyName: policyTabs[tab] })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('changedBy', 'username')
        .lean();
    } else {
      res.status(400).json({ success: false, message: 'Invalid tab parameter.' });
      return;
    }

    res.status(200).json({
      success: true,
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
