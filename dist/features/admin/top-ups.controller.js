"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitBeanTransfer = exports.getBeanTransfers = exports.rejectBeanRequest = exports.approveBeanRequest = exports.submitBeanRequest = exports.getBeanRequestsForTopUp = exports.unblockReseller = exports.blockReseller = exports.rejectReseller = exports.approveReseller = exports.listResellers = exports.unblockTopUpAgent = exports.blockTopUpAgent = exports.rejectTopUpAgent = exports.approveTopUpAgent = exports.listTopUpAgents = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const user_model_1 = require("../auth/user.model");
const bean_transaction_model_1 = require("../beans/bean-transaction.model");
const activity_log_service_1 = require("../activity-log/activity-log.service");
const listTopUpAgents = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
        const filter = { role: 'top_up_agent' };
        const search = req.query.search || '';
        if (search) {
            const re = new RegExp(search, 'i');
            filter.$or = [{ username: re }, { email: re }, { phone: re }];
        }
        const total = await user_model_1.User.countDocuments(filter);
        const items = await user_model_1.User.find(filter).select('username email phone beanWallet isBlocked isSuspended parentId createdAt').skip((page - 1) * limit).limit(limit).lean();
        res.status(200).json({ success: true, items, total, page, totalPages: Math.ceil(total / limit) });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.listTopUpAgents = listTopUpAgents;
const approveTopUpAgent = async (req, res) => {
    try {
        const id = String(req.params.id);
        const user = await user_model_1.User.findByIdAndUpdate(id, { isSuspended: false }, { new: true }).select('username isSuspended');
        if (!user) {
            res.status(404).json({ success: false, message: 'Agent not found.' });
            return;
        }
        await (0, activity_log_service_1.logActivity)({ actorId: req.adminUser.id, actorRole: req.adminUser.role, actionType: 'approve_top_up_agent', targetEntityType: 'User', targetEntityId: id, description: `Approved top-up agent ${user.username}` });
        res.status(200).json({ success: true, user });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.approveTopUpAgent = approveTopUpAgent;
const rejectTopUpAgent = async (req, res) => {
    try {
        const id = String(req.params.id);
        const { reason } = req.body;
        const user = await user_model_1.User.findByIdAndUpdate(id, { isTerminated: true }, { new: true }).select('username isTerminated');
        if (!user) {
            res.status(404).json({ success: false, message: 'Agent not found.' });
            return;
        }
        await (0, activity_log_service_1.logActivity)({ actorId: req.adminUser.id, actorRole: req.adminUser.role, actionType: 'reject_top_up_agent', targetEntityType: 'User', targetEntityId: id, description: `Rejected top-up agent ${user.username}. Reason: ${reason || 'N/A'}` });
        res.status(200).json({ success: true, user });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.rejectTopUpAgent = rejectTopUpAgent;
const blockTopUpAgent = async (req, res) => {
    try {
        const id = String(req.params.id);
        const { type, durationHours } = req.body;
        const update = { isBlocked: true };
        if (type === 'temporary' && durationHours) {
            update.blockedUntil = new Date(Date.now() + Number(durationHours) * 3600 * 1000);
            update.blockType = 'temporary';
        }
        else if (type === 'permanent') {
            update.blockType = 'permanent';
            update.$unset = { blockedUntil: 1 };
        }
        const user = await user_model_1.User.findByIdAndUpdate(id, update, { new: true }).select('username isBlocked blockedUntil blockType');
        if (!user) {
            res.status(404).json({ success: false, message: 'Agent not found.' });
            return;
        }
        await (0, activity_log_service_1.logActivity)({ actorId: req.adminUser.id, actorRole: req.adminUser.role, actionType: 'block_top_up_agent', targetEntityType: 'User', targetEntityId: id, description: `Blocked top-up agent ${user.username}` });
        res.status(200).json({ success: true, user });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.blockTopUpAgent = blockTopUpAgent;
const unblockTopUpAgent = async (req, res) => {
    try {
        const id = String(req.params.id);
        const user = await user_model_1.User.findByIdAndUpdate(id, { isBlocked: false, $unset: { blockedUntil: 1, blockType: 1 } }, { new: true }).select('username isBlocked');
        if (!user) {
            res.status(404).json({ success: false, message: 'Agent not found.' });
            return;
        }
        await (0, activity_log_service_1.logActivity)({ actorId: req.adminUser.id, actorRole: req.adminUser.role, actionType: 'unblock_top_up_agent', targetEntityType: 'User', targetEntityId: id, description: `Unblocked top-up agent ${user.username}` });
        res.status(200).json({ success: true, user });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.unblockTopUpAgent = unblockTopUpAgent;
const listResellers = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
        const agentId = req.params.agentId || req.query.agentId;
        const filter = { role: 'reseller' };
        if (req.adminUser.role === 'top_up_agent') {
            // TUA always sees only their own resellers (parentId = their own user ID)
            filter.parentId = req.adminUser.id;
        }
        else if (agentId) {
            filter.parentId = String(agentId);
        }
        const total = await user_model_1.User.countDocuments(filter);
        const items = await user_model_1.User.find(filter).select('username email phone beanWallet parentId isBlocked isSuspended createdAt').skip((page - 1) * limit).limit(limit).lean();
        res.status(200).json({ success: true, items, total, page, totalPages: Math.ceil(total / limit) });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.listResellers = listResellers;
const approveReseller = async (req, res) => {
    try {
        const id = String(req.params.id);
        const user = await user_model_1.User.findByIdAndUpdate(id, { isSuspended: false }, { new: true }).select('username isSuspended');
        if (!user) {
            res.status(404).json({ success: false, message: 'Reseller not found.' });
            return;
        }
        await (0, activity_log_service_1.logActivity)({ actorId: req.adminUser.id, actorRole: req.adminUser.role, actionType: 'approve_reseller', targetEntityType: 'User', targetEntityId: id, description: `Approved reseller ${user.username}` });
        res.status(200).json({ success: true, user });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.approveReseller = approveReseller;
const rejectReseller = async (req, res) => {
    try {
        const id = String(req.params.id);
        const { reason } = req.body;
        const user = await user_model_1.User.findByIdAndUpdate(id, { isTerminated: true }, { new: true }).select('username isTerminated');
        if (!user) {
            res.status(404).json({ success: false, message: 'Reseller not found.' });
            return;
        }
        await (0, activity_log_service_1.logActivity)({ actorId: req.adminUser.id, actorRole: req.adminUser.role, actionType: 'reject_reseller', targetEntityType: 'User', targetEntityId: id, description: `Rejected reseller ${user.username}. Reason: ${reason || 'N/A'}` });
        res.status(200).json({ success: true, user });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.rejectReseller = rejectReseller;
const blockReseller = async (req, res) => {
    try {
        const id = String(req.params.id);
        const { type, durationHours } = req.body;
        const update = { isBlocked: true };
        if (type === 'temporary' && durationHours) {
            update.blockedUntil = new Date(Date.now() + Number(durationHours) * 3600 * 1000);
            update.blockType = 'temporary';
        }
        else if (type === 'permanent') {
            update.blockType = 'permanent';
            update.$unset = { blockedUntil: 1 };
        }
        const user = await user_model_1.User.findByIdAndUpdate(id, update, { new: true }).select('username isBlocked blockedUntil blockType');
        if (!user) {
            res.status(404).json({ success: false, message: 'Reseller not found.' });
            return;
        }
        await (0, activity_log_service_1.logActivity)({ actorId: req.adminUser.id, actorRole: req.adminUser.role, actionType: 'block_reseller', targetEntityType: 'User', targetEntityId: id, description: `Blocked reseller ${user.username}` });
        res.status(200).json({ success: true, user });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.blockReseller = blockReseller;
const unblockReseller = async (req, res) => {
    try {
        const id = String(req.params.id);
        const user = await user_model_1.User.findByIdAndUpdate(id, { isBlocked: false, $unset: { blockedUntil: 1, blockType: 1 } }, { new: true }).select('username isBlocked');
        if (!user) {
            res.status(404).json({ success: false, message: 'Reseller not found.' });
            return;
        }
        await (0, activity_log_service_1.logActivity)({ actorId: req.adminUser.id, actorRole: req.adminUser.role, actionType: 'unblock_reseller', targetEntityType: 'User', targetEntityId: id, description: `Unblocked reseller ${user.username}` });
        res.status(200).json({ success: true, user });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.unblockReseller = unblockReseller;
const getBeanRequestsForTopUp = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
        const filter = { type: 'request' };
        if (req.adminUser.role === 'top_up_agent') {
            filter.$or = [{ fromId: req.adminUser.id }, { toId: req.adminUser.id }];
        }
        else if (req.adminUser.role === 'reseller') {
            filter.fromId = req.adminUser.id;
        }
        const total = await bean_transaction_model_1.BeanTransaction.countDocuments(filter);
        const items = await bean_transaction_model_1.BeanTransaction.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('fromId', 'username email role')
            .populate('toId', 'username email role')
            .lean();
        res.status(200).json({ success: true, items, total, page, totalPages: Math.ceil(total / limit) });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getBeanRequestsForTopUp = getBeanRequestsForTopUp;
const submitBeanRequest = async (req, res) => {
    try {
        const rawAmount = req.body?.amount ?? req.body?.amount;
        const amount = Number(rawAmount);
        if (!amount || amount <= 0) {
            res.status(400).json({ success: false, message: 'Amount must be positive.' });
            return;
        }
        const uploadedFile = req.file;
        const transferSlipUrl = uploadedFile
            ? `${req.protocol}://${req.get('host')}/uploads/${uploadedFile.filename}`
            : req.body?.transferSlipUrl;
        let toId;
        let toRole = 'company_admin';
        if (req.adminUser.role === 'reseller') {
            const me = await user_model_1.User.findById(req.adminUser.id).select('parentId');
            if (me?.parentId) {
                toId = me.parentId.toString();
                toRole = 'top_up_agent';
            }
        }
        const tx = await bean_transaction_model_1.BeanTransaction.create({
            type: 'request',
            fromId: req.adminUser.id,
            fromRole: req.adminUser.role,
            toId,
            toRole,
            amount,
            transferSlipUrl,
            status: 'pending',
        });
        await (0, activity_log_service_1.logActivity)({
            actorId: req.adminUser.id,
            actorRole: req.adminUser.role,
            actionType: 'submit_bean_request',
            targetEntityType: 'BeanTransaction',
            targetEntityId: tx._id.toString(),
            description: `Requested ${amount} beans`,
        });
        res.status(200).json({ success: true, request: tx });
    }
    catch (err) {
        console.error('[submitBeanRequest] error:', err.message, err.stack);
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.submitBeanRequest = submitBeanRequest;
const approveBeanRequest = async (req, res) => {
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const id = String(req.params.id);
        const tx = await bean_transaction_model_1.BeanTransaction.findById(id).session(session);
        if (!tx) {
            await session.abortTransaction();
            session.endSession();
            res.status(404).json({ success: false, message: 'Bean request not found.' });
            return;
        }
        if (tx.status !== 'pending') {
            await session.abortTransaction();
            session.endSession();
            res.status(400).json({ success: false, message: `Request is already ${tx.status}.` });
            return;
        }
        const actor = req.adminUser;
        if (actor.role === 'top_up_agent') {
            const tua = await user_model_1.User.findById(actor.id).session(session).select('beanWallet');
            if (!tua || tua.beanWallet < tx.amount) {
                await session.abortTransaction();
                session.endSession();
                res.status(400).json({ success: false, message: 'Insufficient bean wallet balance to approve this request.' });
                return;
            }
            await user_model_1.User.findByIdAndUpdate(actor.id, { $inc: { beanWallet: -tx.amount } }, { session });
        }
        // Credit beans to requester's wallet
        await user_model_1.User.findByIdAndUpdate(tx.fromId, { $inc: { beanWallet: tx.amount } }, { session });
        tx.status = 'completed';
        tx.toId = actor.id;
        await tx.save({ session });
        await session.commitTransaction();
        await (0, activity_log_service_1.logActivity)({
            actorId: actor.id, actorRole: actor.role,
            actionType: 'approve_bean_request', targetEntityType: 'BeanTransaction', targetEntityId: id,
            description: `Approved bean request of ${tx.amount} beans for user ${tx.fromId}`,
        });
        res.status(200).json({ success: true, request: tx });
    }
    catch (err) {
        await session.abortTransaction();
        res.status(500).json({ success: false, message: err.message });
    }
    finally {
        session.endSession();
    }
};
exports.approveBeanRequest = approveBeanRequest;
const rejectBeanRequest = async (req, res) => {
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const id = String(req.params.id);
        const { reason } = req.body;
        const tx = await bean_transaction_model_1.BeanTransaction.findById(id).session(session);
        if (!tx) {
            await session.abortTransaction();
            session.endSession();
            res.status(404).json({ success: false, message: 'Bean request not found.' });
            return;
        }
        if (tx.status !== 'pending') {
            await session.abortTransaction();
            session.endSession();
            res.status(400).json({ success: false, message: `Request is already ${tx.status}.` });
            return;
        }
        tx.status = 'rejected';
        tx.toId = req.adminUser.id;
        if (reason)
            tx.note = reason;
        await tx.save({ session });
        await session.commitTransaction();
        await (0, activity_log_service_1.logActivity)({
            actorId: req.adminUser.id, actorRole: req.adminUser.role,
            actionType: 'reject_bean_request', targetEntityType: 'BeanTransaction', targetEntityId: id,
            description: `Rejected bean request of ${tx.amount} beans. Reason: ${reason || 'N/A'}`,
        });
        res.status(200).json({ success: true, request: tx });
    }
    catch (err) {
        await session.abortTransaction();
        res.status(500).json({ success: false, message: err.message });
    }
    finally {
        session.endSession();
    }
};
exports.rejectBeanRequest = rejectBeanRequest;
const getBeanTransfers = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
        const filter = { type: { $in: ['assign', 'transfer'] } };
        if (req.adminUser.role === 'top_up_agent' || req.adminUser.role === 'reseller')
            filter.fromId = req.adminUser.id;
        const total = await bean_transaction_model_1.BeanTransaction.countDocuments(filter);
        const items = await bean_transaction_model_1.BeanTransaction.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('fromId', 'username email role')
            .populate('toId', 'username email role')
            .lean();
        res.status(200).json({ success: true, items, total, page, totalPages: Math.ceil(total / limit) });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getBeanTransfers = getBeanTransfers;
const submitBeanTransfer = async (req, res) => {
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const rawRecipient = (req.body?.recipientId || '').trim();
        const amount = Number(req.body?.amount);
        if (!rawRecipient || !amount || amount <= 0) {
            await session.abortTransaction();
            session.endSession();
            res.status(400).json({ success: false, message: 'recipientId and positive amount required.' });
            return;
        }
        const transferSlipUrl = req.body?.transferSlipUrl;
        const sender = await user_model_1.User.findById(req.adminUser.id).session(session).select('beanWallet role username');
        if (!sender) {
            res.status(404).json({ success: false, message: 'Sender not found.' });
            await session.abortTransaction();
            session.endSession();
            return;
        }
        if (sender.beanWallet < amount) {
            res.status(400).json({ success: false, message: 'Insufficient bean wallet balance.' });
            await session.abortTransaction();
            session.endSession();
            return;
        }
        const isEmail = rawRecipient.includes('@');
        const query = isEmail
            ? { email: rawRecipient.toLowerCase() }
            : mongoose_1.default.Types.ObjectId.isValid(rawRecipient)
                ? { $or: [{ _id: rawRecipient }, { username: rawRecipient }] }
                : { username: rawRecipient };
        const recipient = await user_model_1.User.findOne(query).session(session).select('beanWallet diamonds username role');
        if (!recipient) {
            res.status(404).json({ success: false, message: `Recipient '${rawRecipient}' not found.` });
            await session.abortTransaction();
            session.endSession();
            return;
        }
        await user_model_1.User.findByIdAndUpdate(sender._id, { $inc: { beanWallet: -amount } }, { session });
        if (['user', 'host'].includes(recipient.role)) {
            await user_model_1.User.findByIdAndUpdate(recipient._id, { $inc: { diamonds: amount, beanWallet: amount } }, { session });
        }
        else {
            await user_model_1.User.findByIdAndUpdate(recipient._id, { $inc: { beanWallet: amount } }, { session });
        }
        const tx = await bean_transaction_model_1.BeanTransaction.create([{
                type: 'transfer',
                fromId: sender._id,
                fromRole: sender.role,
                toId: recipient._id,
                toRole: recipient.role,
                amount,
                transferSlipUrl,
                status: 'completed',
            }], { session });
        await session.commitTransaction();
        await (0, activity_log_service_1.logActivity)({
            actorId: req.adminUser.id,
            actorRole: req.adminUser.role,
            actionType: 'bean_transfer',
            targetEntityType: 'User',
            targetEntityId: recipient._id.toString(),
            description: `Transferred ${amount} beans to ${recipient.username} (${recipient.role})`,
        });
        res.status(200).json({ success: true, transfer: tx[0] });
    }
    catch (err) {
        await session.abortTransaction();
        res.status(500).json({ success: false, message: err.message });
    }
    finally {
        session.endSession();
    }
};
exports.submitBeanTransfer = submitBeanTransfer;
