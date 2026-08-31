import { Request, Response } from 'express';
import { CountryPolicy, ICountryPolicy } from './country-policy.model';
import { PolicyLog } from './policy-log.model';
import { AdminAuthRequest } from '../../core/middlewares/rbac.middleware';
import { User } from '../auth/user.model';

// Seed default policy values as specified in policy guide
export const DEFAULT_COUNTRY_POLICIES = [
  { countryCode: 'PK', countryName: 'Pakistan', currency: 'PKR', marketRate: 278, inAppRate: 270, withdrawalChargePercent: 2.0, taxPercent: 0.5, isDefault: true },
  { countryCode: 'IN', countryName: 'India', currency: 'INR', marketRate: 96, inAppRate: 90, withdrawalChargePercent: 2.0, taxPercent: 1.0, isDefault: false },
  { countryCode: 'BD', countryName: 'Bangladesh', currency: 'BDT', marketRate: 120, inAppRate: 115, withdrawalChargePercent: 2.0, taxPercent: 0.5, isDefault: false },
  { countryCode: 'AE', countryName: 'UAE', currency: 'AED', marketRate: 3.67, inAppRate: 3.5, withdrawalChargePercent: 2.0, taxPercent: 0.0, isDefault: false },
  { countryCode: 'SA', countryName: 'Saudi Arabia', currency: 'SAR', marketRate: 3.75, inAppRate: 3.6, withdrawalChargePercent: 2.0, taxPercent: 0.0, isDefault: false },
  { countryCode: 'GB', countryName: 'UK', currency: 'GBP', marketRate: 0.80, inAppRate: 0.75, withdrawalChargePercent: 2.0, taxPercent: 0.0, isDefault: false },
  { countryCode: 'EU', countryName: 'Europe', currency: 'EUR', marketRate: 0.92, inAppRate: 0.85, withdrawalChargePercent: 2.0, taxPercent: 0.0, isDefault: false },
];

export const seedCountryPolicies = async (): Promise<void> => {
  try {
    for (const policy of DEFAULT_COUNTRY_POLICIES) {
      const exists = await CountryPolicy.findOne({ countryCode: policy.countryCode });
      if (!exists) {
        await CountryPolicy.create(policy);
      }
    }
  } catch (error) {
    console.error('Error seeding country policies:', error);
  }
};

// ─── GET /api/policy/countries ───────────────────────────────────────────────
export const getAllCountryPolicies = async (_req: Request, res: Response): Promise<void> => {
  try {
    let policies = await CountryPolicy.find().sort({ countryName: 1 }).lean();
    if (policies.length === 0) {
      await seedCountryPolicies();
      policies = await CountryPolicy.find().sort({ countryName: 1 }).lean();
    }
    res.status(200).json({ success: true, count: policies.length, policies });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /api/policy/country (Auto Detect or By Code) ──────────────────────────
export const getCountryPolicy = async (req: Request, res: Response): Promise<void> => {
  try {
    let code = (req.query.code as string || '').toUpperCase().trim();

    // If user is authenticated, fallback to user.country if query code missing
    if (!code && (req as any).user?.id) {
      const dbUser = await User.findById((req as any).user.id).select('country region').lean();
      if (dbUser?.country) {
        code = dbUser.country.toUpperCase();
      }
    }

    // IP Geolocation fallback header or IP
    if (!code) {
      const cloudflareCountry = req.headers['cf-ipcountry'] as string;
      if (cloudflareCountry && cloudflareCountry.length === 2) {
        code = cloudflareCountry.toUpperCase();
      }
    }

    let policy = code ? await CountryPolicy.findOne({ countryCode: code }).lean() : null;

    if (!policy) {
      policy = await CountryPolicy.findOne({ isDefault: true }).lean();
    }
    if (!policy) {
      policy = await CountryPolicy.findOne({ countryCode: 'PK' }).lean();
    }

    res.status(200).json({
      success: true,
      detectedCode: code || 'PK',
      policy,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST/PUT /api/policy/countries (Admin) ──────────────────────────────────
export const upsertCountryPolicy = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { countryCode, countryName, currency, marketRate, inAppRate, withdrawalChargePercent, taxPercent, isDefault } = req.body;

    if (!countryCode || !countryName || !currency || inAppRate === undefined || marketRate === undefined) {
      res.status(400).json({ success: false, message: 'Missing required country policy fields.' });
      return;
    }

    const uppercaseCode = countryCode.toUpperCase().trim();
    const existing = await CountryPolicy.findOne({ countryCode: uppercaseCode });

    const prevValue = existing ? existing.toObject() : null;

    const policy = await CountryPolicy.findOneAndUpdate(
      { countryCode: uppercaseCode },
      {
        countryCode: uppercaseCode,
        countryName: countryName.trim(),
        currency: currency.toUpperCase().trim(),
        marketRate: Number(marketRate),
        inAppRate: Number(inAppRate),
        withdrawalChargePercent: Number(withdrawalChargePercent ?? 2.0),
        taxPercent: Number(taxPercent ?? 0.0),
        isDefault: Boolean(isDefault),
      },
      { upsert: true, new: true }
    );

    if (isDefault) {
      await CountryPolicy.updateMany(
        { countryCode: { $ne: uppercaseCode } },
        { isDefault: false }
      );
    }

    await PolicyLog.create({
      policyName: 'country_policy_update',
      previousValue: prevValue,
      newValue: policy.toObject(),
      changedBy: req.adminUser!.id,
      countryCode: uppercaseCode,
    });

    res.status(200).json({ success: true, policy });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
