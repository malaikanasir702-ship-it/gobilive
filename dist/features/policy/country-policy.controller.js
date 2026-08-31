"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertCountryPolicy = exports.getCountryPolicy = exports.getAllCountryPolicies = exports.seedCountryPolicies = exports.DEFAULT_COUNTRY_POLICIES = void 0;
const country_policy_model_1 = require("./country-policy.model");
const policy_log_model_1 = require("./policy-log.model");
const user_model_1 = require("../auth/user.model");
// Seed default policy values as specified in policy guide
exports.DEFAULT_COUNTRY_POLICIES = [
    { countryCode: 'PK', countryName: 'Pakistan', currency: 'PKR', marketRate: 278, inAppRate: 270, withdrawalChargePercent: 2.0, taxPercent: 0.5, isDefault: true },
    { countryCode: 'IN', countryName: 'India', currency: 'INR', marketRate: 96, inAppRate: 90, withdrawalChargePercent: 2.0, taxPercent: 1.0, isDefault: false },
    { countryCode: 'BD', countryName: 'Bangladesh', currency: 'BDT', marketRate: 120, inAppRate: 115, withdrawalChargePercent: 2.0, taxPercent: 0.5, isDefault: false },
    { countryCode: 'AE', countryName: 'UAE', currency: 'AED', marketRate: 3.67, inAppRate: 3.5, withdrawalChargePercent: 2.0, taxPercent: 0.0, isDefault: false },
    { countryCode: 'SA', countryName: 'Saudi Arabia', currency: 'SAR', marketRate: 3.75, inAppRate: 3.6, withdrawalChargePercent: 2.0, taxPercent: 0.0, isDefault: false },
    { countryCode: 'GB', countryName: 'UK', currency: 'GBP', marketRate: 0.80, inAppRate: 0.75, withdrawalChargePercent: 2.0, taxPercent: 0.0, isDefault: false },
    { countryCode: 'EU', countryName: 'Europe', currency: 'EUR', marketRate: 0.92, inAppRate: 0.85, withdrawalChargePercent: 2.0, taxPercent: 0.0, isDefault: false },
];
const seedCountryPolicies = async () => {
    try {
        for (const policy of exports.DEFAULT_COUNTRY_POLICIES) {
            const exists = await country_policy_model_1.CountryPolicy.findOne({ countryCode: policy.countryCode });
            if (!exists) {
                await country_policy_model_1.CountryPolicy.create(policy);
            }
        }
    }
    catch (error) {
        console.error('Error seeding country policies:', error);
    }
};
exports.seedCountryPolicies = seedCountryPolicies;
// ─── GET /api/policy/countries ───────────────────────────────────────────────
const getAllCountryPolicies = async (_req, res) => {
    try {
        let policies = await country_policy_model_1.CountryPolicy.find().sort({ countryName: 1 }).lean();
        if (policies.length === 0) {
            await (0, exports.seedCountryPolicies)();
            policies = await country_policy_model_1.CountryPolicy.find().sort({ countryName: 1 }).lean();
        }
        res.status(200).json({ success: true, count: policies.length, policies });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getAllCountryPolicies = getAllCountryPolicies;
// ─── GET /api/policy/country (Auto Detect or By Code) ──────────────────────────
const getCountryPolicy = async (req, res) => {
    try {
        let code = (req.query.code || '').toUpperCase().trim();
        // If user is authenticated, fallback to user.country if query code missing
        if (!code && req.user?.id) {
            const dbUser = await user_model_1.User.findById(req.user.id).select('country region').lean();
            if (dbUser?.country) {
                code = dbUser.country.toUpperCase();
            }
        }
        // IP Geolocation fallback header or IP
        if (!code) {
            const cloudflareCountry = req.headers['cf-ipcountry'];
            if (cloudflareCountry && cloudflareCountry.length === 2) {
                code = cloudflareCountry.toUpperCase();
            }
        }
        let policy = code ? await country_policy_model_1.CountryPolicy.findOne({ countryCode: code }).lean() : null;
        if (!policy) {
            policy = await country_policy_model_1.CountryPolicy.findOne({ isDefault: true }).lean();
        }
        if (!policy) {
            policy = await country_policy_model_1.CountryPolicy.findOne({ countryCode: 'PK' }).lean();
        }
        res.status(200).json({
            success: true,
            detectedCode: code || 'PK',
            policy,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getCountryPolicy = getCountryPolicy;
// ─── POST/PUT /api/policy/countries (Admin) ──────────────────────────────────
const upsertCountryPolicy = async (req, res) => {
    try {
        const { countryCode, countryName, currency, marketRate, inAppRate, withdrawalChargePercent, taxPercent, isDefault } = req.body;
        if (!countryCode || !countryName || !currency || inAppRate === undefined || marketRate === undefined) {
            res.status(400).json({ success: false, message: 'Missing required country policy fields.' });
            return;
        }
        const uppercaseCode = countryCode.toUpperCase().trim();
        const existing = await country_policy_model_1.CountryPolicy.findOne({ countryCode: uppercaseCode });
        const prevValue = existing ? existing.toObject() : null;
        const policy = await country_policy_model_1.CountryPolicy.findOneAndUpdate({ countryCode: uppercaseCode }, {
            countryCode: uppercaseCode,
            countryName: countryName.trim(),
            currency: currency.toUpperCase().trim(),
            marketRate: Number(marketRate),
            inAppRate: Number(inAppRate),
            withdrawalChargePercent: Number(withdrawalChargePercent ?? 2.0),
            taxPercent: Number(taxPercent ?? 0.0),
            isDefault: Boolean(isDefault),
        }, { upsert: true, new: true });
        if (isDefault) {
            await country_policy_model_1.CountryPolicy.updateMany({ countryCode: { $ne: uppercaseCode } }, { isDefault: false });
        }
        await policy_log_model_1.PolicyLog.create({
            policyName: 'country_policy_update',
            previousValue: prevValue,
            newValue: policy.toObject(),
            changedBy: req.adminUser.id,
            countryCode: uppercaseCode,
        });
        res.status(200).json({ success: true, policy });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.upsertCountryPolicy = upsertCountryPolicy;
