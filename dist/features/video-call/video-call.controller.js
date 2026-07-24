"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCallToken = exports.endVideoCall = exports.leaveMatchQueue = exports.joinMatchQueue = void 0;
const agora_1 = require("../../config/agora");
const platform_settings_model_1 = require("../settings/platform-settings.model");
const user_model_1 = require("../auth/user.model");
const wallet_service_1 = require("../wallet/wallet.service");
const matchQueue = [];
const activeCalls = {};
const joinMatchQueue = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const settings = await (0, platform_settings_model_1.getPlatformSettings)();
        const user = await user_model_1.User.findById(req.user.id);
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        if (user.rcoins < settings.videoCallRcoinCost) {
            res.status(400).json({
                success: false,
                message: `Need at least ${settings.videoCallRcoinCost} Beans for video calls.`,
            });
            return;
        }
        const userId = req.user.id;
        const existing = matchQueue.find((e) => e.userId === userId);
        if (existing) {
            res.status(200).json({ success: true, status: 'waiting' });
            return;
        }
        matchQueue.push({
            userId,
            username: user.username,
            joinedAt: Date.now(),
        });
        const opponentIdx = matchQueue.findIndex((e) => e.userId !== userId);
        if (opponentIdx === -1) {
            res.status(200).json({ success: true, status: 'waiting' });
            return;
        }
        const opponent = matchQueue.splice(opponentIdx, 1)[0];
        const meIdx = matchQueue.findIndex((e) => e.userId === userId);
        if (meIdx !== -1)
            matchQueue.splice(meIdx, 1);
        const channelName = `call_${userId}_${opponent.userId}_${Date.now()}`;
        activeCalls[channelName] = { channelName, users: [userId, opponent.userId] };
        await (0, wallet_service_1.spendVideoCallRcoins)(userId, settings.videoCallRcoinCost);
        const token = (0, agora_1.buildAgoraRtcToken)(channelName, 0, 'publisher');
        res.status(200).json({
            success: true,
            status: 'matched',
            match: {
                channelName,
                opponent: { userId: opponent.userId, username: opponent.username },
                agora: {
                    appId: process.env.AGORA_APP_ID || '',
                    channelName,
                    uid: 0,
                    token,
                },
            },
        });
    }
    catch (error) {
        const status = error instanceof wallet_service_1.WalletServiceError ? error.status : 500;
        res.status(status).json({ success: false, message: error.message });
    }
};
exports.joinMatchQueue = joinMatchQueue;
const leaveMatchQueue = async (req, res) => {
    if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized.' });
        return;
    }
    const idx = matchQueue.findIndex((e) => e.userId === req.user.id);
    if (idx !== -1)
        matchQueue.splice(idx, 1);
    res.status(200).json({ success: true });
};
exports.leaveMatchQueue = leaveMatchQueue;
const endVideoCall = async (req, res) => {
    const { channelName } = req.body;
    delete activeCalls[channelName];
    res.status(200).json({ success: true });
};
exports.endVideoCall = endVideoCall;
const getCallToken = async (req, res) => {
    const channelName = String(req.params.channelName);
    const token = (0, agora_1.buildAgoraRtcToken)(channelName, 0, 'publisher');
    res.status(200).json({
        success: true,
        agora: {
            appId: process.env.AGORA_APP_ID || '',
            channelName,
            uid: 0,
            token,
        },
    });
};
exports.getCallToken = getCallToken;
