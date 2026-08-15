"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateThumbnail = exports.reportRoom = exports.hideCreator = exports.saveRoom = exports.likeRoom = exports.getSessionSummary = exports.getMySessions = exports.getPkEligibleHosts = exports.findPkOpponent = exports.kickViewer = exports.endRoom = exports.getAgoraCredentials = exports.createRoom = exports.getPublicRooms = exports.getActiveRooms = void 0;
exports.injectLiveControllerIo = injectLiveControllerIo;
const mongoose_1 = __importDefault(require("mongoose"));
const live_model_1 = __importDefault(require("./live.model"));
const report_model_1 = __importDefault(require("./report.model"));
const agora_1 = require("../../config/agora");
const platform_settings_model_1 = require("../settings/platform-settings.model");
const user_model_1 = require("../auth/user.model");
const follow_model_1 = require("../auth/follow.model");
// Keep a reference to io for broadcasting live_ended
let _io = null;
function injectLiveControllerIo(io) { _io = io; }
const getActiveRooms = async (req, res) => {
    try {
        const followingOnly = req.query.following === 'true';
        const category = (req.query.category || '').trim().toLowerCase();
        const viewerId = req.user?.id;
        // Delete any previously seeded demo rooms so they are removed from the database
        await live_model_1.default.deleteMany({ channelName: { $regex: /^seed_/ } });
        // Get viewer's hidden creators list
        let hiddenHosts = [];
        if (viewerId) {
            const viewer = await user_model_1.User.findById(viewerId).select('hiddenCreators').lean();
            hiddenHosts = viewer?.hiddenCreators ?? [];
        }
        const filter = {
            isActive: true,
            privacyMode: { $ne: 'private' },
        };
        if (hiddenHosts.length > 0) {
            filter.hostUsername = { $nin: hiddenHosts };
        }
        if (followingOnly && viewerId) {
            const follows = await follow_model_1.Follow.find({ followerId: viewerId }).select('followingId');
            const hostIds = follows.map((f) => f.followingId);
            if (hostIds.length === 0) {
                res.status(200).json({ success: true, rooms: [] });
                return;
            }
            filter.hostId = { $in: hostIds };
        }
        let rooms = await live_model_1.default.find(filter)
            .sort({ viewerCount: -1, createdAt: -1 })
            .limit(50)
            .populate('hostId', 'profilePic')
            .lean();
        if (category) {
            rooms = rooms.filter((r) => (r.category || '').toLowerCase() === category);
        }
        // Attach isLiked, isSaved, likesCount, roomType per room for current viewer
        const enriched = rooms.map((r) => ({
            ...r,
            hostProfilePic: r.hostId?.profilePic ?? '',
            likesCount: r.likedBy?.length ?? 0,
            isLiked: viewerId ? r.likedBy?.some((id) => id.toString() === viewerId) ?? false : false,
            isSaved: viewerId ? r.savedBy?.some((id) => id.toString() === viewerId) ?? false : false,
            roomType: r.roomType ?? 'live',
            seatLayoutCount: r.seatLayoutCount ?? 9,
            thumbnailUrl: r.thumbnailUrl ?? '',
        }));
        res.status(200).json({ success: true, rooms: enriched });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getActiveRooms = getActiveRooms;
const getPublicRooms = async (req, res) => {
    try {
        const category = (req.query.category || '').trim().toLowerCase();
        const isPk = req.query.pk === 'true';
        const filter = {
            isActive: true,
            privacyMode: { $ne: 'private' },
        };
        if (isPk) {
            filter.isPKActive = true;
        }
        let rooms = await live_model_1.default.find(filter)
            .sort({ viewerCount: -1, createdAt: -1 })
            .limit(50)
            .populate('hostId', 'profilePic')
            .lean();
        if (category) {
            rooms = rooms.filter((r) => (r.category || '').toLowerCase() === category);
        }
        const enriched = rooms.map((r) => ({
            ...r,
            hostProfilePic: r.hostId?.profilePic ?? '',
            likesCount: r.likedBy?.length ?? 0,
            roomType: r.roomType ?? 'live',
            thumbnailUrl: r.thumbnailUrl ?? '',
        }));
        res.status(200).json({ success: true, rooms: enriched });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getPublicRooms = getPublicRooms;
const createRoom = async (req, res) => {
    try {
        const user = req.user;
        const { title, privacyMode = 'public', category = '', 
        // NEW: multi-broadcast fields (optional — safe default 'live')
        roomType = 'live', seatLayoutCount = 9, } = req.body;
        const settings = await (0, platform_settings_model_1.getPlatformSettings)();
        const dbUser = await user_model_1.User.findById(user.id);
        if ((dbUser?.level ?? 1) < settings.minLevelToGoLive) {
            return res.status(403).json({
                success: false,
                message: `Minimum level ${settings.minLevelToGoLive} required to go live.`,
            });
        }
        // Validate roomType — fall back gracefully if unknown value sent
        const validRoomTypes = ['live', 'multi-broadcast', 'audio'];
        const resolvedRoomType = validRoomTypes.includes(roomType) ? roomType : 'live';
        // Validate seatLayoutCount — only used for multi-broadcast / audio
        const validLayouts = [2, 4, 9, 13, 16];
        const parsed = Number(seatLayoutCount);
        const resolvedLayout = validLayouts.includes(parsed) ? parsed : 9;
        const channelName = `room_${user.id}_${Date.now()}`;
        const token = (0, agora_1.buildAgoraRtcToken)(channelName, 0, 'publisher');
        const room = await live_model_1.default.create({
            channelName,
            hostId: user.id,
            hostUsername: user.username,
            hostLevel: dbUser?.level ?? 1,
            title: title || `${user.username}'s Live`,
            privacyMode,
            category: category || '',
            isActive: true,
            roomType: resolvedRoomType,
            seatLayoutCount: resolvedLayout,
        });
        res.status(201).json({
            success: true,
            room,
            agora: {
                appId: process.env.AGORA_APP_ID || '',
                channelName: room.channelName,
                uid: 0,
                token,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.createRoom = createRoom;
const getAgoraCredentials = async (req, res) => {
    try {
        const { channelName } = req.params;
        const room = await live_model_1.default.findOne({ channelName, isActive: true });
        if (!room) {
            return res.status(404).json({ success: false, message: 'Live room not found.' });
        }
        const viewerId = req.user?.id;
        if (room.blockedViewers.includes(viewerId)) {
            return res.status(403).json({ success: false, message: 'You are blocked from this stream.' });
        }
        if (room.privacyMode === 'private' && viewerId && room.hostId.toString() !== viewerId) {
            return res.status(403).json({ success: false, message: 'Private stream — host access only.' });
        }
        if (room.privacyMode === 'followers' && viewerId) {
            const follows = await follow_model_1.Follow.findOne({ followerId: viewerId, followingId: room.hostId });
            if (!follows && room.hostId.toString() !== viewerId) {
                return res.status(403).json({ success: false, message: 'Followers only stream.' });
            }
        }
        const isHost = Boolean(viewerId && room.hostId.toString() === viewerId);
        let isOpponentHost = false;
        if (viewerId) {
            const myActiveRoom = await live_model_1.default.findOne({ hostId: viewerId, isActive: true });
            if (myActiveRoom && myActiveRoom.isPKActive && myActiveRoom.opponentRoomId === room.channelName) {
                isOpponentHost = true;
            }
        }
        const role = (isHost || isOpponentHost) ? 'publisher' : 'subscriber';
        const token = (0, agora_1.buildAgoraRtcToken)(room.channelName, 0, role);
        res.status(200).json({
            success: true,
            agora: {
                appId: process.env.AGORA_APP_ID || '',
                channelName: room.channelName,
                uid: 0,
                token,
                role,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getAgoraCredentials = getAgoraCredentials;
const endRoom = async (req, res) => {
    try {
        const user = req.user;
        const { channelName } = req.params;
        const room = await live_model_1.default.findOne({ channelName, hostId: user.id });
        if (!room) {
            return res.status(404).json({ success: false, message: 'Room not found or not owned by you.' });
        }
        const durationSeconds = Math.floor((Date.now() - room.createdAt.getTime()) / 1000);
        room.isActive = false;
        room.isPKActive = false;
        room.sessionSummary = {
            durationSeconds,
            totalViewers: room.peakViewers,
            giftsReceived: room.totalGifts,
            diamondsEarned: room.totalDiamondsEarned,
            totalHearts: room.totalHearts ?? 0,
            endedAt: new Date(),
        };
        await room.save();
        // Notify all viewers in the room that the host ended the live
        _io?.to(room.channelName).emit('live_ended', {
            channelName: room.channelName,
            hostUsername: room.hostUsername,
            sessionSummary: room.sessionSummary,
        });
        res.status(200).json({ success: true, room, sessionSummary: room.sessionSummary });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.endRoom = endRoom;
const kickViewer = async (req, res) => {
    try {
        const user = req.user;
        const { channelName } = req.params;
        const { viewerId } = req.body;
        const room = await live_model_1.default.findOne({ channelName, hostId: user.id });
        if (!room) {
            return res.status(404).json({ success: false, message: 'Room not found.' });
        }
        if (!room.blockedViewers.includes(viewerId)) {
            room.blockedViewers.push(viewerId);
            await room.save();
        }
        res.status(200).json({ success: true, blockedViewers: room.blockedViewers });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.kickViewer = kickViewer;
const findPkOpponent = async (req, res) => {
    try {
        const user = req.user;
        const { channelName } = req.params;
        const myRoom = await live_model_1.default.findOne({ channelName, hostId: user.id, isActive: true });
        if (!myRoom) {
            return res.status(404).json({ success: false, message: 'Your active room not found.' });
        }
        const opponent = await live_model_1.default.findOne({
            channelName: { $ne: channelName },
            isActive: true,
            isPKActive: false,
            hostId: { $ne: user.id },
        }).sort({ viewerCount: -1, createdAt: -1 });
        if (!opponent) {
            return res.status(404).json({ success: false, message: 'No opponent available for PK right now.' });
        }
        myRoom.isPKActive = true;
        myRoom.opponentRoomId = opponent.channelName;
        myRoom.opponentHost = opponent.hostUsername;
        opponent.isPKActive = true;
        opponent.opponentRoomId = myRoom.channelName;
        opponent.opponentHost = myRoom.hostUsername;
        await myRoom.save();
        await opponent.save();
        res.status(200).json({
            success: true,
            opponent: {
                channelName: opponent.channelName,
                hostUsername: opponent.hostUsername,
                hostLevel: opponent.hostLevel,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.findPkOpponent = findPkOpponent;
/**
 * GET /rooms/pk/eligible?search=&channelName=myRoom
 *
 * Returns active live rooms that are eligible for a PK battle invite.
 * Excludes: the calling host's own room, rooms already in PK, inactive rooms.
 * Supports optional ?search= filter on hostUsername (case-insensitive).
 */
const getPkEligibleHosts = async (req, res) => {
    try {
        const user = req.user;
        const myChannelName = (req.query.channelName || '').trim();
        const search = (req.query.search || '').trim();
        const filter = {
            isActive: true,
            isPKActive: false,
            hostId: { $ne: user.id },
        };
        if (myChannelName) {
            filter.channelName = { $ne: myChannelName };
        }
        if (search) {
            filter.hostUsername = { $regex: search, $options: 'i' };
        }
        const rooms = await live_model_1.default.find(filter)
            .sort({ viewerCount: -1, createdAt: -1 })
            .limit(30)
            .populate('hostId', 'profilePic')
            .lean();
        const result = rooms.map((r) => ({
            channelName: r.channelName,
            hostUsername: r.hostUsername,
            hostLevel: r.hostLevel ?? 1,
            viewerCount: r.viewerCount ?? 0,
            hostProfilePic: r.hostId?.profilePic ?? '',
            title: r.title ?? '',
        }));
        res.status(200).json({ success: true, hosts: result });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getPkEligibleHosts = getPkEligibleHosts;
const getMySessions = async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, message: 'Unauthorized.' });
        }
        const sessions = await live_model_1.default.find({ hostId: user.id, isActive: false })
            .sort({ updatedAt: -1 })
            .limit(50)
            .lean();
        const stats = {
            totalSessions: sessions.length,
            totalLiveSeconds: sessions.reduce((s, r) => s + (r.sessionSummary?.durationSeconds ?? 0), 0),
            totalDiamondsEarned: sessions.reduce((s, r) => s + (r.sessionSummary?.diamondsEarned ?? r.totalDiamondsEarned ?? 0), 0),
            totalHearts: sessions.reduce((s, r) => s + (r.sessionSummary?.totalHearts ?? r.totalHearts ?? 0), 0),
        };
        res.status(200).json({ success: true, sessions, stats });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getMySessions = getMySessions;
const getSessionSummary = async (req, res) => {
    try {
        const { channelName } = req.params;
        const room = await live_model_1.default.findOne({ channelName }).lean();
        if (!room) {
            return res.status(404).json({ success: false, message: 'Room not found.' });
        }
        res.status(200).json({ success: true, sessionSummary: room.sessionSummary });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getSessionSummary = getSessionSummary;
const likeRoom = async (req, res) => {
    try {
        const user = req.user;
        const { channelName } = req.params;
        const userId = new mongoose_1.default.Types.ObjectId(user.id);
        const room = await live_model_1.default.findOne({ channelName });
        if (!room)
            return res.status(404).json({ success: false, message: 'Room not found.' });
        const alreadyLiked = room.likedBy.some((id) => id.toString() === user.id);
        if (alreadyLiked) {
            room.likedBy = room.likedBy.filter((id) => id.toString() !== user.id);
        }
        else {
            room.likedBy.push(userId);
        }
        await room.save();
        res.status(200).json({
            success: true,
            liked: !alreadyLiked,
            likesCount: room.likedBy.length,
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.likeRoom = likeRoom;
const saveRoom = async (req, res) => {
    try {
        const user = req.user;
        const { channelName } = req.params;
        const userId = new mongoose_1.default.Types.ObjectId(user.id);
        const room = await live_model_1.default.findOne({ channelName });
        if (!room)
            return res.status(404).json({ success: false, message: 'Room not found.' });
        const alreadySaved = room.savedBy.some((id) => id.toString() === user.id);
        if (alreadySaved) {
            room.savedBy = room.savedBy.filter((id) => id.toString() !== user.id);
        }
        else {
            room.savedBy.push(userId);
        }
        await room.save();
        res.status(200).json({ success: true, saved: !alreadySaved });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.saveRoom = saveRoom;
const hideCreator = async (req, res) => {
    try {
        const user = req.user;
        const { hostUsername } = req.body;
        if (!hostUsername)
            return res.status(400).json({ success: false, message: 'hostUsername required.' });
        await user_model_1.User.findByIdAndUpdate(user.id, {
            $addToSet: { hiddenCreators: hostUsername },
        });
        res.status(200).json({ success: true, message: `@${hostUsername} hidden from your discovery.` });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.hideCreator = hideCreator;
const reportRoom = async (req, res) => {
    try {
        const user = req.user;
        const channelName = req.params.channelName;
        const { reason } = req.body;
        if (!reason)
            return res.status(400).json({ success: false, message: 'reason required.' });
        const room = await live_model_1.default.findOne({ channelName }).lean();
        if (!room)
            return res.status(404).json({ success: false, message: 'Room not found.' });
        await report_model_1.default.create({
            reporterUsername: user.username,
            hostUsername: room.hostUsername,
            roomId: channelName,
            reason,
        });
        res.status(201).json({ success: true, message: 'Report submitted. Our team will review it.' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.reportRoom = reportRoom;
/**
 * PATCH /rooms/:channelName/thumbnail
 *
 * Host calls this after capturing a snapshot of their stream.
 * Saves the Cloudinary URL into the LiveRoom document so the
 * discovery page can show a real preview instead of a plain gradient.
 *
 * Body: { thumbnailUrl: string }
 */
const updateThumbnail = async (req, res) => {
    try {
        const user = req.user;
        const channelName = req.params.channelName;
        const { thumbnailUrl } = req.body;
        if (!thumbnailUrl || typeof thumbnailUrl !== 'string') {
            res.status(400).json({ success: false, message: 'thumbnailUrl is required.' });
            return;
        }
        const room = await live_model_1.default.findOneAndUpdate({ channelName, hostId: user.id, isActive: true }, { $set: { thumbnailUrl } }, { new: true }).lean();
        if (!room) {
            res.status(404).json({ success: false, message: 'Active room not found or not owned by you.' });
            return;
        }
        res.status(200).json({ success: true, thumbnailUrl });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.updateThumbnail = updateThumbnail;
