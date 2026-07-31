"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicAgents = exports.deductBeans = exports.getBeanLogs = exports.updateDollarConversionRate = exports.getDollarConversionRates = exports.updateD2BRate = exports.getD2BRate = exports.updateD2BCommission = exports.getD2BCommission = exports.updateBeanDollarRate = exports.getBeanDollarRate = exports.assignBeans = exports.previewRecipient = exports.generateBeans = exports.getBeanWallet = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const user_model_1 = require("../auth/user.model");
const bean_transaction_model_1 = require("./bean-transaction.model");
const policy_log_model_1 = require("../policy/policy-log.model");
const platform_settings_model_1 = require("../settings/platform-settings.model");
const activity_log_service_1 = require("../activity-log/activity-log.service");
// ─── Bean Wallet ─────────────────────────────────────────────────────────────
// Accessible by company_admin, top_up_agent, and reseller
const getBeanWallet = async (req, res) => {
    try {
        const user = await user_model_1.User.findById(req.adminUser.id).select('beanWallet').lean();
        res.status(200).json({ success: true, beanWallet: user?.beanWallet ?? 0 });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getBeanWallet = getBeanWallet;
// ─── Generate Beans ───────────────────────────────────────────────────────────
const generateBeans = async (req, res) => {
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const { amount } = req.body;
        if (!amount || amount <= 0) {
            res.status(400).json({ success: false, message: 'Amount must be a positive number.' });
            return;
        }
        const admin = await user_model_1.User.findByIdAndUpdate(req.adminUser.id, { $inc: { beanWallet: amount } }, { new: true, session }).select('beanWallet');
        await bean_transaction_model_1.BeanTransaction.create([
            {
                type: 'generate',
                toId: req.adminUser.id,
                toRole: 'company_admin',
                amount,
                status: 'completed',
                note: `Generated ${amount} beans`,
            },
        ], { session });
        await session.commitTransaction();
        await (0, activity_log_service_1.logActivity)({
            actorId: req.adminUser.id,
            actorRole: req.adminUser.role,
            actionType: 'generate_beans',
            targetEntityType: 'User',
            targetEntityId: req.adminUser.id,
            description: `Generated ${amount} beans. New wallet balance: ${admin?.beanWallet}`,
        });
        res.status(200).json({ success: true, beanWallet: admin?.beanWallet, generated: amount });
    }
    catch (error) {
        await session.abortTransaction();
        res.status(500).json({ success: false, message: error.message });
    }
    finally {
        session.endSession();
    }
};
exports.generateBeans = generateBeans;
// ─── Preview Recipient (for assign-beans confirmation modal) ─────────────────
const previewRecipient = async (req, res) => {
    try {
        const raw = ((req.query.q || req.body?.recipientIdOrEmail) || '').trim();
        if (!raw) {
            res.status(400).json({ success: false, message: 'recipientIdOrEmail is required.' });
            return;
        }
        const isEmail = raw.includes('@');
        const query = isEmail
            ? { email: raw.toLowerCase() }
            : mongoose_1.default.Types.ObjectId.isValid(raw)
                ? { _id: raw }
                : { username: raw };
        const user = await user_model_1.User.findOne(query)
            .select('username email phone role beanWallet isBlocked isSuspended isTerminated isGiftingSuspended country region profilePic')
            .lean();
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        if (!['top_up_agent', 'reseller'].includes(user.role)) {
            res.status(400).json({
                success: false,
                message: `This user is a "${user.role}". Beans can only be assigned to Top Up Agents or Resellers.`,
            });
            return;
        }
        res.status(200).json({
            success: true,
            user: {
                id: user._id,
                username: user.username,
                email: user.email ?? null,
                phone: user.phone ?? null,
                role: user.role,
                beanWallet: user.beanWallet ?? 0,
                isBlocked: user.isBlocked,
                isSuspended: user.isSuspended,
                isTerminated: user.isTerminated,
                isGiftingSuspended: user.isGiftingSuspended ?? false,
                country: user.country ?? null,
                region: user.region ?? null,
                profilePic: user.profilePic ?? '',
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.previewRecipient = previewRecipient;
// ─── Assign Beans ─────────────────────────────────────────────────────────────
const assignBeans = async (req, res) => {
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const { recipientId, email, amount, transferSlipUrl } = req.body;
        if (!amount || amount <= 0) {
            res.status(400).json({ success: false, message: 'Amount must be a positive number.' });
            return;
        }
        // recipientId field may contain either a MongoDB ObjectId OR an email address
        // (the frontend sends whatever the admin typed into "Recipient ID or Email")
        const rawRecipient = (recipientId || email || '').trim();
        const isEmail = rawRecipient.includes('@');
        const query = isEmail
            ? { email: rawRecipient.toLowerCase() }
            : mongoose_1.default.Types.ObjectId.isValid(rawRecipient)
                ? { _id: rawRecipient }
                : { username: rawRecipient };
        const recipient = await user_model_1.User.findOne(query).select('role beanWallet username').session(session);
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
        const admin = await user_model_1.User.findById(req.adminUser.id).select('beanWallet').session(session);
        if (!admin || admin.beanWallet < amount) {
            res.status(400).json({ success: false, message: 'Insufficient bean wallet balance.' });
            return;
        }
        await user_model_1.User.findByIdAndUpdate(req.adminUser.id, { $inc: { beanWallet: -amount } }, { session });
        // Credit beans and auto-lift gifting suspension if balance becomes >= 0
        const updatedRecipient = await user_model_1.User.findByIdAndUpdate(recipient._id, { $inc: { beanWallet: amount } }, { new: true, session }).select('beanWallet isGiftingSuspended');
        if (updatedRecipient && (updatedRecipient.beanWallet ?? 0) >= 0 && updatedRecipient.isGiftingSuspended) {
            await user_model_1.User.findByIdAndUpdate(recipient._id, { isGiftingSuspended: false }, { session });
        }
        await bean_transaction_model_1.BeanTransaction.create([
            {
                type: 'assign',
                fromId: req.adminUser.id,
                fromRole: 'company_admin',
                toId: recipient._id,
                toRole: recipient.role,
                amount,
                transferSlipUrl,
                status: 'completed',
                note: `Assigned by company admin`,
            },
        ], { session });
        await session.commitTransaction();
        await (0, activity_log_service_1.logActivity)({
            actorId: req.adminUser.id,
            actorRole: req.adminUser.role,
            actionType: 'assign_beans',
            targetEntityType: 'User',
            targetEntityId: recipient._id.toString(),
            description: `Assigned ${amount} beans to ${recipient.username} (${recipient.role})`,
        });
        res.status(200).json({ success: true, assigned: amount, recipientUsername: recipient.username });
    }
    catch (error) {
        await session.abortTransaction();
        res.status(500).json({ success: false, message: error.message });
    }
    finally {
        session.endSession();
    }
};
exports.assignBeans = assignBeans;
// ─── Bean Dollar Rate ─────────────────────────────────────────────────────────
const getBeanDollarRate = async (_req, res) => {
    try {
        const settings = await (0, platform_settings_model_1.getPlatformSettings)();
        res.status(200).json({
            success: true,
            beanDollarRateUsd: settings.beanDollarRateUsd,
            beanDollarRateBeans: settings.beanDollarRateBeans,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getBeanDollarRate = getBeanDollarRate;
const updateBeanDollarRate = async (req, res) => {
    try {
        const { usd, beans } = req.body;
        if (!usd || !beans || usd <= 0 || beans <= 0) {
            res.status(400).json({ success: false, message: 'USD amount and Bean amount must be positive.' });
            return;
        }
        const settings = await (0, platform_settings_model_1.getPlatformSettings)();
        const prev = { usd: settings.beanDollarRateUsd, beans: settings.beanDollarRateBeans };
        settings.beanDollarRateUsd = usd;
        settings.beanDollarRateBeans = beans;
        await settings.save();
        await policy_log_model_1.PolicyLog.create({
            policyName: 'bean_dollar_rate',
            previousValue: prev,
            newValue: { usd, beans },
            changedBy: req.adminUser.id,
        });
        res.status(200).json({ success: true, beanDollarRateUsd: usd, beanDollarRateBeans: beans });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateBeanDollarRate = updateBeanDollarRate;
// ─── Diamond to Bean Commission ───────────────────────────────────────────────
const getD2BCommission = async (_req, res) => {
    try {
        const settings = await (0, platform_settings_model_1.getPlatformSettings)();
        res.status(200).json({ success: true, diamondToBeanCommission: settings.diamondToBeanCommission });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getD2BCommission = getD2BCommission;
const updateD2BCommission = async (req, res) => {
    try {
        const { commission } = req.body;
        if (commission === undefined || commission < 0 || commission > 100) {
            res.status(400).json({ success: false, message: 'Commission must be between 0 and 100.' });
            return;
        }
        const settings = await (0, platform_settings_model_1.getPlatformSettings)();
        const prev = settings.diamondToBeanCommission;
        settings.diamondToBeanCommission = commission;
        await settings.save();
        await policy_log_model_1.PolicyLog.create({
            policyName: 'diamond_to_bean_commission',
            previousValue: prev,
            newValue: commission,
            changedBy: req.adminUser.id,
        });
        res.status(200).json({ success: true, diamondToBeanCommission: commission });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateD2BCommission = updateD2BCommission;
// ─── Diamond to Bean Rate ─────────────────────────────────────────────────────
const getD2BRate = async (_req, res) => {
    try {
        const settings = await (0, platform_settings_model_1.getPlatformSettings)();
        res.status(200).json({ success: true, diamondToBeanRate: settings.diamondToBeanRate });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getD2BRate = getD2BRate;
const updateD2BRate = async (req, res) => {
    try {
        const { rate } = req.body;
        if (!rate || rate <= 0) {
            res.status(400).json({ success: false, message: 'Rate must be a positive number.' });
            return;
        }
        const settings = await (0, platform_settings_model_1.getPlatformSettings)();
        const prev = settings.diamondToBeanRate;
        settings.diamondToBeanRate = rate;
        await settings.save();
        await policy_log_model_1.PolicyLog.create({
            policyName: 'diamond_to_bean_rate',
            previousValue: prev,
            newValue: rate,
            changedBy: req.adminUser.id,
        });
        res.status(200).json({ success: true, diamondToBeanRate: rate });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateD2BRate = updateD2BRate;
// ─── Dollar Conversion Rates ──────────────────────────────────────────────────
// Stored in a separate collection via PolicyLog with policyName 'dollar_conversion_rate'
// and countryCode field. We maintain the live rates in a simple document.
const dollar_conversion_rate_model_1 = require("./dollar-conversion-rate.model");
const getDollarConversionRates = async (_req, res) => {
    try {
        const rates = await dollar_conversion_rate_model_1.DollarConversionRate.find().lean();
        res.status(200).json({ success: true, rates });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getDollarConversionRates = getDollarConversionRates;
const updateDollarConversionRate = async (req, res) => {
    try {
        const { countryCode, countryName, rate } = req.body;
        if (!countryCode || !rate || rate <= 0) {
            res.status(400).json({ success: false, message: 'countryCode and rate are required.' });
            return;
        }
        const existing = await dollar_conversion_rate_model_1.DollarConversionRate.findOne({ countryCode: countryCode.toUpperCase() });
        const prev = existing?.rate ?? null;
        await dollar_conversion_rate_model_1.DollarConversionRate.findOneAndUpdate({ countryCode: countryCode.toUpperCase() }, { countryCode: countryCode.toUpperCase(), countryName, rate }, { upsert: true, new: true });
        await policy_log_model_1.PolicyLog.create({
            policyName: 'dollar_conversion_rate',
            previousValue: prev,
            newValue: rate,
            changedBy: req.adminUser.id,
            countryCode: countryCode.toUpperCase(),
        });
        res.status(200).json({ success: true, countryCode, rate });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateDollarConversionRate = updateDollarConversionRate;
// ─── Bean Logs (tabbed) ───────────────────────────────────────────────────────
const getBeanLogs = async (req, res) => {
    try {
        const tab = req.query.tab || 'assigned_beans';
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
        const skip = (page - 1) * limit;
        let data = [];
        let total = 0;
        const policyTabs = {
            bean_dollar_rate: 'bean_dollar_rate',
            d2b_rate: 'diamond_to_bean_rate',
            d2b_commission: 'diamond_to_bean_commission',
            dollar_conversion: 'dollar_conversion_rate',
        };
        if (tab === 'assigned_beans') {
            total = await bean_transaction_model_1.BeanTransaction.countDocuments({ type: 'assign' });
            data = await bean_transaction_model_1.BeanTransaction.find({ type: 'assign' })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('fromId', 'username')
                .populate('toId', 'username role')
                .lean();
        }
        else if (tab === 'deducted_beans') {
            total = await bean_transaction_model_1.BeanTransaction.countDocuments({ type: 'deduct' });
            data = await bean_transaction_model_1.BeanTransaction.find({ type: 'deduct' })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('fromId', 'username')
                .populate('toId', 'username role')
                .lean();
        }
        else if (tab === 'generated_beans') {
            total = await bean_transaction_model_1.BeanTransaction.countDocuments({ type: 'generate' });
            data = await bean_transaction_model_1.BeanTransaction.find({ type: 'generate' })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('fromId', 'username role')
                .populate('toId', 'username role')
                .lean();
        }
        else if (policyTabs[tab]) {
            total = await policy_log_model_1.PolicyLog.countDocuments({ policyName: policyTabs[tab] });
            data = await policy_log_model_1.PolicyLog.find({ policyName: policyTabs[tab] })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('changedBy', 'username')
                .lean();
        }
        else {
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
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getBeanLogs = getBeanLogs;
// ─── Deduct / Revoke Beans ────────────────────────────────────────────────────
// Allows company_admin to forcibly subtract beans from any user/agent/reseller.
// Balance can go negative (overdraft). When negative, gifting is auto-suspended.
// When a subsequent top-up clears the negative balance, suspension is auto-lifted.
const deductBeans = async (req, res) => {
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const { recipientIdOrEmail, amount, reason } = req.body;
        if (!amount || Number(amount) <= 0) {
            res.status(400).json({ success: false, message: 'Amount must be a positive number.' });
            return;
        }
        const deductAmount = Number(amount);
        if (!recipientIdOrEmail) {
            res.status(400).json({ success: false, message: 'recipientIdOrEmail is required.' });
            return;
        }
        // Resolve recipient by ID, email, or username
        const raw = String(recipientIdOrEmail).trim();
        const isEmail = raw.includes('@');
        const query = isEmail
            ? { email: raw.toLowerCase() }
            : mongoose_1.default.Types.ObjectId.isValid(raw)
                ? { _id: raw }
                : { username: raw };
        const recipient = await user_model_1.User.findOne(query).select('username role beanWallet isGiftingSuspended').session(session);
        if (!recipient) {
            await session.abortTransaction();
            res.status(404).json({ success: false, message: 'Recipient not found.' });
            return;
        }
        // Compute new balance (allow negative overdraft)
        const previousBalance = recipient.beanWallet ?? 0;
        const newBalance = previousBalance - deductAmount;
        // Auto-freeze gifting if balance goes negative
        const shouldSuspend = newBalance < 0;
        await user_model_1.User.findByIdAndUpdate(recipient._id, {
            $inc: { beanWallet: -deductAmount },
            isGiftingSuspended: shouldSuspend,
        }, { session });
        // Record the deduction in BeanTransaction audit trail
        await bean_transaction_model_1.BeanTransaction.create([
            {
                type: 'deduct',
                fromId: req.adminUser.id, // admin who performed deduction
                fromRole: req.adminUser.role,
                toId: recipient._id,
                toRole: recipient.role,
                amount: deductAmount,
                status: 'completed',
                note: reason ? `Deducted by admin. Reason: ${reason}` : 'Deducted by admin.',
            },
        ], { session });
        await session.commitTransaction();
        // Activity log (outside session — fire-and-forget)
        await (0, activity_log_service_1.logActivity)({
            actorId: req.adminUser.id,
            actorRole: req.adminUser.role,
            actionType: 'bean_deduction',
            targetEntityType: 'User',
            targetEntityId: recipient._id.toString(),
            description: `Deducted ${deductAmount} beans from ${recipient.username} (${recipient.role}). Previous: ${previousBalance} → New: ${newBalance}. Gifting suspended: ${shouldSuspend}`,
            metadata: { previousBalance, newBalance, deductAmount, reason: reason || null },
        });
        res.status(200).json({
            success: true,
            message: `Successfully deducted ${deductAmount.toLocaleString()} beans from @${recipient.username}.${shouldSuspend ? ' ⚠️ Account gifting has been suspended due to negative balance.' : ''}`,
            recipientUsername: recipient.username,
            previousBalance,
            newBalance,
            isGiftingSuspended: shouldSuspend,
        });
    }
    catch (error) {
        await session.abortTransaction();
        res.status(500).json({ success: false, message: error.message });
    }
    finally {
        session.endSession();
    }
};
exports.deductBeans = deductBeans;
// ─── Public: Top-up Agents list (Flutter app) ────────────────────────────────
const getPublicAgents = async (req, res) => {
    try {
        const agents = await user_model_1.User.find({
            role: { $in: ['top_up_agent', 'reseller'] },
            isBlocked: false,
            isSuspended: false,
            isTerminated: false,
        }).select('username profilePic phone region country beanWallet sharePercent role').lean();
        const result = agents.map(a => ({
            id: a._id,
            username: a.username,
            profilePic: a.profilePic || '',
            phone: a.phone || '',
            region: a.region || '',
            country: a.country || '',
            role: a.role,
            beansAvailable: a.beanWallet || 0,
            commissionPercent: a.sharePercent || 0,
        }));
        res.json({ success: true, agents: result });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getPublicAgents = getPublicAgents;
