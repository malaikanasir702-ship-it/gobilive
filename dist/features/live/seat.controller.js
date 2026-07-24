"use strict";
/**
 * seat.controller.ts
 *
 * HTTP REST handlers for the multi-broadcast seat management system.
 * All seat mutations are also broadcast to the Socket.IO room via the
 * exported `getIo()` helper so the Flutter UI updates in real-time
 * without requiring a page reload.
 *
 * ── Route summary ──
 * POST /rooms/:channelName/seats/init         — Host: initialise seats for layout
 * POST /rooms/:channelName/seats/:idx/request — Viewer: request to join a seat
 * POST /rooms/:channelName/seats/:idx/accept  — Host: accept viewer's seat request
 * POST /rooms/:channelName/seats/:idx/reject  — Host: reject viewer's seat request
 * POST /rooms/:channelName/seats/:idx/leave   — Occupant or host: vacate seat
 * PATCH /rooms/:channelName/seats/:idx/mute   — Host: remotely mute / unmute
 * PATCH /rooms/:channelName/seats/:idx/cam    — Host: grant / revoke camera
 * GET   /rooms/:channelName/seats             — Anyone: fetch current seat state
 * GET   /rooms/:channelName/seat-token        — Authenticated user: refresh token
 * POST  /rooms/:channelName/side-callers/request — Viewer: request side call
 * POST  /rooms/:channelName/side-callers/:uid/accept  — Host: accept side caller
 * POST  /rooms/:channelName/side-callers/:uid/remove  — Host: remove side caller
 * POST  /rooms/:channelName/vips              — Host: set VIP list
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setVips = exports.removeSideCaller = exports.acceptSideCaller = exports.requestSideCaller = exports.getSeatToken = exports.getSeats = exports.setCamPermission = exports.muteSeat = exports.leaveSeat = exports.rejectSeat = exports.acceptSeat = exports.requestSeat = exports.initSeats = void 0;
exports.injectIo = injectIo;
const mongoose_1 = __importDefault(require("mongoose"));
const live_model_1 = __importDefault(require("./live.model"));
const agora_1 = require("../../config/agora");
const user_model_1 = require("../auth/user.model");
let _io = null;
/** Called once from index.ts after Socket.IO is created. */
function injectIo(io) {
    _io = io;
}
/** Emit a seat-state snapshot to everyone in the room. */
function broadcastSeatUpdate(channelName, seats) {
    _io?.to(channelName).emit('seat_state_changed', { channelName, seats });
}
/** Emit a targeted control command to a specific seat occupant. */
function broadcastSeatControl(channelName, payload) {
    _io?.to(channelName).emit('seat_control', { channelName, ...payload });
}
// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function user(req) {
    return req.user;
}
/**
 * Express v5 types req.params values as `string | string[]`.
 * This helper always returns a plain string, safe to pass anywhere.
 */
function param(req, key) {
    const v = req.params[key];
    return Array.isArray(v) ? v[0] : (v ?? '');
}
function badRequest(res, msg) {
    return res.status(400).json({ success: false, message: msg });
}
function notFound(res, msg = 'Room not found.') {
    return res.status(404).json({ success: false, message: msg });
}
function forbidden(res, msg = 'Forbidden.') {
    return res.status(403).json({ success: false, message: msg });
}
// ─────────────────────────────────────────────
// 1. Initialise Seats
// ─────────────────────────────────────────────
/**
 * Host calls this once when starting a multi-broadcast or audio room.
 * Creates empty seat stubs for the chosen layout count.
 * Re-initialising resets all seats (removes everyone — only allowed
 * when all seats are already empty to prevent accidental disconnects).
 */
const initSeats = async (req, res) => {
    try {
        const me = user(req);
        const channelName = param(req, 'channelName');
        const { seatLayoutCount, roomType } = req.body;
        const validLayouts = [2, 4, 9, 13, 16];
        if (!validLayouts.includes(seatLayoutCount)) {
            badRequest(res, `seatLayoutCount must be one of: ${validLayouts.join(', ')}`);
            return;
        }
        const room = await live_model_1.default.findOne({ channelName, hostId: me.id, isActive: true });
        if (!room) {
            notFound(res, 'Active room not found or not owned by you.');
            return;
        }
        // Safety: refuse re-init while seats are occupied
        const occupiedCount = room.seats.filter((s) => s.userId != null).length;
        if (occupiedCount > 0) {
            badRequest(res, 'Cannot re-initialise while seats are occupied. Clear all seats first.');
            return;
        }
        // Build fresh seat array
        // Seat 0 is always the "Anchor Seat" — automatically assigned to the host.
        // Remaining seats (1..N-1) start empty and are available for guests.
        const hostUser = await user_model_1.User.findById(me.id).select('username profilePic').lean();
        const newSeats = Array.from({ length: seatLayoutCount }, (_, i) => {
            if (i === 0) {
                // ── Anchor Seat: pre-assigned to host ──────────────────────────────
                return {
                    seatIndex: 0,
                    userId: new mongoose_1.default.Types.ObjectId(me.id),
                    username: hostUser?.username ?? me.username,
                    profilePic: hostUser?.profilePic ?? '',
                    agoraUid: (0, agora_1.seatIndexToAgoraUid)(0),
                    isMutedByHost: false,
                    isCamAllowedByHost: true, // host always has camera
                    isAudioOnly: false, // host broadcasts video by default
                    occupiedAt: new Date(),
                };
            }
            // ── Guest seats: empty ─────────────────────────────────────────────
            return {
                seatIndex: i,
                userId: null,
                username: '',
                profilePic: '',
                agoraUid: (0, agora_1.seatIndexToAgoraUid)(i),
                isMutedByHost: false,
                isCamAllowedByHost: false,
                isAudioOnly: true,
            };
        });
        room.seats = newSeats;
        room.seatLayoutCount = seatLayoutCount;
        room.roomType = roomType ?? 'multi-broadcast';
        await room.save();
        broadcastSeatUpdate(channelName, room.seats);
        // Issue a host token so the Flutter client can join the Agora channel immediately
        const hostTokenResult = await (0, agora_1.buildSeatToken)(channelName, me.id);
        res.status(200).json({
            success: true,
            seatLayoutCount,
            roomType: room.roomType,
            seats: room.seats,
            agora: {
                appId: process.env.AGORA_APP_ID || '',
                channelName,
                uid: hostTokenResult.uid,
                token: hostTokenResult.token,
                role: hostTokenResult.role,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.initSeats = initSeats;
// ─────────────────────────────────────────────
// 2. Request Seat (viewer → host)
// ─────────────────────────────────────────────
/**
 * Viewer sends a seat join request.
 * The request is stored on the seat as a pending state and the host
 * receives a 'seat_request' Socket.IO event to accept or reject it.
 */
const requestSeat = async (req, res) => {
    try {
        const me = user(req);
        const channelName = param(req, 'channelName');
        const idx = param(req, 'idx');
        const seatIndex = parseInt(idx, 10);
        const room = await live_model_1.default.findOne({ channelName, isActive: true });
        if (!room) {
            notFound(res);
            return;
        }
        // Block the room host from using the seat flow
        if (room.hostId.toString() === me.id) {
            badRequest(res, 'Host cannot request a seat — you are always the broadcaster.');
            return;
        }
        // Seat 0 is reserved as the host anchor seat — guests cannot request it
        if (seatIndex === 0) {
            badRequest(res, 'Seat 0 is reserved for the host.');
            return;
        }
        if (isNaN(seatIndex) || seatIndex < 0 || seatIndex >= room.seats.length) {
            badRequest(res, 'Invalid seat index.');
            return;
        }
        const seat = room.seats[seatIndex];
        if (seat.userId != null) {
            badRequest(res, 'Seat is already occupied.');
            return;
        }
        // Ensure requester is not already in another seat
        const alreadySeated = room.seats.find((s) => s.userId && s.userId.toString() === me.id);
        if (alreadySeated) {
            badRequest(res, 'You are already occupying seat ' + alreadySeated.seatIndex);
            return;
        }
        // Fetch user info for display
        const dbUser = await user_model_1.User.findById(me.id).select('profilePic username').lean();
        // Signal the host via Socket.IO — host UI can show a pop-up
        _io?.to(channelName).emit('seat_request', {
            channelName,
            seatIndex,
            userId: me.id,
            username: me.username,
            profilePic: dbUser?.profilePic ?? '',
        });
        res.status(200).json({
            success: true,
            message: 'Seat request sent. Waiting for host approval.',
            seatIndex,
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.requestSeat = requestSeat;
// ─────────────────────────────────────────────
// 3. Accept Seat Request (host only)
// ─────────────────────────────────────────────
/**
 * Host accepts a pending seat request by userId.
 * Assigns the user to the seat with audio-only defaults.
 * The occupant receives a 'seat_accepted' event with a fresh Agora token.
 */
const acceptSeat = async (req, res) => {
    try {
        const me = user(req);
        const channelName = param(req, 'channelName');
        const idx = param(req, 'idx');
        const { userId, isAudioOnly = true } = req.body;
        const seatIndex = parseInt(idx, 10);
        const room = await live_model_1.default.findOne({ channelName, hostId: me.id, isActive: true });
        if (!room) {
            notFound(res, 'Active room not found or not owned by you.');
            return;
        }
        if (isNaN(seatIndex) || seatIndex < 0 || seatIndex >= room.seats.length) {
            badRequest(res, 'Invalid seat index.');
            return;
        }
        const seat = room.seats[seatIndex];
        if (seat.userId != null) {
            badRequest(res, 'Seat is already occupied.');
            return;
        }
        // Ensure target user exists
        const targetUser = await user_model_1.User.findById(userId).select('username profilePic').lean();
        if (!targetUser) {
            notFound(res, 'User not found.');
            return;
        }
        // Assign seat
        seat.userId = new mongoose_1.default.Types.ObjectId(userId);
        seat.username = targetUser.username;
        seat.profilePic = targetUser.profilePic ?? '';
        seat.isAudioOnly = isAudioOnly;
        seat.isMutedByHost = false;
        // If host accepted with video (isAudioOnly=false), grant camera immediately.
        // Previously this was always false which caused the video tile to never render
        // because seat_tile.dart requires BOTH !isAudioOnly AND isCamAllowedByHost=true.
        seat.isCamAllowedByHost = !isAudioOnly;
        seat.occupiedAt = new Date();
        room.markModified('seats');
        await room.save();
        // Issue a dedicated publisher token for the seat occupant
        const tokenResult = await (0, agora_1.buildSeatToken)(channelName, userId);
        // Notify the specific user that their seat request was accepted.
        // Include isCamAllowedByHost so the Flutter client can enable the
        // camera immediately without waiting for a separate cam_permission event.
        _io?.to(channelName).emit('seat_accepted', {
            channelName,
            seatIndex,
            userId,
            agoraUid: seat.agoraUid,
            token: tokenResult.token,
            isAudioOnly: seat.isAudioOnly,
            isCamAllowedByHost: seat.isCamAllowedByHost,
        });
        broadcastSeatUpdate(channelName, room.seats);
        res.status(200).json({
            success: true,
            seat,
            agora: tokenResult,
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.acceptSeat = acceptSeat;
// ─────────────────────────────────────────────
// 4. Reject Seat Request (host only)
// ─────────────────────────────────────────────
const rejectSeat = async (req, res) => {
    try {
        const me = user(req);
        const channelName = param(req, 'channelName');
        const idx = param(req, 'idx');
        const { userId } = req.body;
        const seatIndex = parseInt(idx, 10);
        const room = await live_model_1.default.findOne({ channelName, hostId: me.id, isActive: true });
        if (!room) {
            notFound(res, 'Active room not found or not owned by you.');
            return;
        }
        _io?.to(channelName).emit('seat_rejected', {
            channelName,
            seatIndex,
            userId,
            reason: 'Host declined your seat request.',
        });
        res.status(200).json({ success: true, message: 'Seat request rejected.' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.rejectSeat = rejectSeat;
// ─────────────────────────────────────────────
// 5. Leave Seat
// ─────────────────────────────────────────────
/**
 * Either the occupant voluntarily leaves or the host forces them off.
 * Clears the seat entry and broadcasts the updated state.
 */
const leaveSeat = async (req, res) => {
    try {
        const me = user(req);
        const channelName = param(req, 'channelName');
        const idx = param(req, 'idx');
        const seatIndex = parseInt(idx, 10);
        const room = await live_model_1.default.findOne({ channelName, isActive: true });
        if (!room) {
            notFound(res);
            return;
        }
        if (isNaN(seatIndex) || seatIndex < 0 || seatIndex >= room.seats.length) {
            badRequest(res, 'Invalid seat index.');
            return;
        }
        const seat = room.seats[seatIndex];
        const isHost = room.hostId.toString() === me.id;
        const isOccupant = seat.userId && seat.userId.toString() === me.id;
        if (!isHost && !isOccupant) {
            forbidden(res, 'Only the host or the seat occupant can vacate this seat.');
            return;
        }
        // Seat 0 is the host anchor seat — it cannot be vacated
        if (seatIndex === 0) {
            badRequest(res, 'Seat 0 is the host anchor seat and cannot be vacated.');
            return;
        }
        const evictedUserId = seat.userId?.toString();
        // Reset seat
        seat.userId = null;
        seat.username = '';
        seat.profilePic = '';
        seat.isMutedByHost = false;
        seat.isCamAllowedByHost = false;
        seat.isAudioOnly = true;
        seat.occupiedAt = undefined;
        room.markModified('seats');
        await room.save();
        // Tell the evicted user to switch back to Subscriber role
        if (evictedUserId) {
            _io?.to(channelName).emit('seat_vacated', {
                channelName,
                seatIndex,
                userId: evictedUserId,
                kickedByHost: isHost && !isOccupant,
            });
        }
        broadcastSeatUpdate(channelName, room.seats);
        res.status(200).json({ success: true, message: 'Seat vacated.', seats: room.seats });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.leaveSeat = leaveSeat;
// ─────────────────────────────────────────────
// 6. Remote Mute / Unmute (host only)
// ─────────────────────────────────────────────
/**
 * Host can remotely mute or unmute the microphone of any seat.
 * The Flutter client listens for 'seat_control' events and calls
 * `engine.muteLocalAudioStream(muted)` on the correct Agora UID.
 */
const muteSeat = async (req, res) => {
    try {
        const me = user(req);
        const channelName = param(req, 'channelName');
        const idx = param(req, 'idx');
        const { muted } = req.body;
        const seatIndex = parseInt(idx, 10);
        const room = await live_model_1.default.findOne({ channelName, hostId: me.id, isActive: true });
        if (!room) {
            notFound(res, 'Active room not found or not owned by you.');
            return;
        }
        if (isNaN(seatIndex) || seatIndex < 0 || seatIndex >= room.seats.length) {
            badRequest(res, 'Invalid seat index.');
            return;
        }
        room.seats[seatIndex].isMutedByHost = muted;
        room.markModified('seats');
        await room.save();
        broadcastSeatControl(channelName, {
            action: 'mute_audio',
            seatIndex,
            userId: room.seats[seatIndex].userId?.toString(),
            agoraUid: room.seats[seatIndex].agoraUid,
            muted,
        });
        // Also broadcast the full seat state so every client's tile
        // re-renders with the updated isMutedByHost flag immediately.
        broadcastSeatUpdate(channelName, room.seats);
        res.status(200).json({ success: true, seatIndex, isMutedByHost: muted });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.muteSeat = muteSeat;
// ─────────────────────────────────────────────
// 7. Grant / Revoke Camera (host only)
// ─────────────────────────────────────────────
/**
 * Camera streams are OFF by default (audio-only pipeline).
 * Host must explicitly grant camera permission per seat.
 * Flutter client listens for 'seat_control' and calls
 * `engine.muteLocalVideoStream(!allowed)`.
 */
const setCamPermission = async (req, res) => {
    try {
        const me = user(req);
        const channelName = param(req, 'channelName');
        const idx = param(req, 'idx');
        const { allowed } = req.body;
        const seatIndex = parseInt(idx, 10);
        const room = await live_model_1.default.findOne({ channelName, hostId: me.id, isActive: true });
        if (!room) {
            notFound(res, 'Active room not found or not owned by you.');
            return;
        }
        if (isNaN(seatIndex) || seatIndex < 0 || seatIndex >= room.seats.length) {
            badRequest(res, 'Invalid seat index.');
            return;
        }
        room.seats[seatIndex].isCamAllowedByHost = allowed;
        // When camera is granted, also mark the seat as video (not audio-only).
        // When camera is revoked, mark it back to audio-only.
        if (allowed) {
            room.seats[seatIndex].isAudioOnly = false;
        }
        else {
            room.seats[seatIndex].isAudioOnly = true;
        }
        room.markModified('seats');
        await room.save();
        broadcastSeatControl(channelName, {
            action: 'cam_permission',
            seatIndex,
            userId: room.seats[seatIndex].userId?.toString(),
            agoraUid: room.seats[seatIndex].agoraUid,
            allowed,
        });
        // Also broadcast the full seat state so every client's tile
        // re-renders from isAudioOnly=false / isCamAllowedByHost=true
        broadcastSeatUpdate(channelName, room.seats);
        res.status(200).json({ success: true, seatIndex, isCamAllowedByHost: allowed });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.setCamPermission = setCamPermission;
// ─────────────────────────────────────────────
// 8. Get Seat State
// ─────────────────────────────────────────────
const getSeats = async (req, res) => {
    try {
        const me = user(req);
        const channelName = param(req, 'channelName');
        const room = await live_model_1.default.findOne({ channelName, isActive: true })
            .select('seats seatLayoutCount roomType vips sideCallers hostUsername')
            .lean();
        if (!room) {
            notFound(res);
            return;
        }
        // Issue a viewer (or seated broadcaster) token so the Flutter client
        // can join the Agora channel as soon as it loads the seat grid.
        const viewerTokenResult = await (0, agora_1.buildSeatToken)(channelName, me.id);
        res.status(200).json({
            success: true,
            seatLayoutCount: room.seatLayoutCount,
            roomType: room.roomType,
            seats: room.seats,
            vips: room.vips,
            sideCallers: room.sideCallers,
            agora: {
                appId: process.env.AGORA_APP_ID || '',
                channelName,
                uid: viewerTokenResult.uid,
                token: viewerTokenResult.token,
                role: viewerTokenResult.role,
                isHost: viewerTokenResult.isHost,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getSeats = getSeats;
// ─────────────────────────────────────────────
// 9. Refresh Seat Token
// ─────────────────────────────────────────────
/**
 * Client calls this endpoint before the current token expires (ideally at
 * the halfway point of the token lifetime).  Returns a new token with the
 * same Broadcaster/Subscriber role mapping as the initial join.
 */
const getSeatToken = async (req, res) => {
    try {
        const me = user(req);
        const channelName = param(req, 'channelName');
        const tokenResult = await (0, agora_1.buildSeatToken)(channelName, me.id);
        res.status(200).json({
            success: true,
            agora: {
                appId: process.env.AGORA_APP_ID || '',
                channelName,
                ...tokenResult,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getSeatToken = getSeatToken;
// ─────────────────────────────────────────────
// 10. Side Caller: Request
// ─────────────────────────────────────────────
/**
 * Used with single-host streams (roomType === 'live').
 * Viewer can request to appear as a side caller in the scrollable overlay.
 */
const requestSideCaller = async (req, res) => {
    try {
        const me = user(req);
        const channelName = param(req, 'channelName');
        const { isAudioOnly = false } = req.body;
        const room = await live_model_1.default.findOne({ channelName, isActive: true });
        if (!room) {
            notFound(res);
            return;
        }
        // Max 6 side callers at a time
        if (room.sideCallers.length >= 6) {
            badRequest(res, 'Maximum 6 side callers allowed at once.');
            return;
        }
        // Check not already in the list
        const existing = room.sideCallers.find((c) => c.userId.toString() === me.id);
        if (existing) {
            badRequest(res, 'You already have a pending or active side call.');
            return;
        }
        const dbUser = await user_model_1.User.findById(me.id).select('username profilePic').lean();
        const callerUid = (0, agora_1.seatIndexToAgoraUid)(2000 + room.sideCallers.length);
        room.sideCallers.push({
            userId: new mongoose_1.default.Types.ObjectId(me.id),
            username: dbUser?.username ?? me.username,
            profilePic: dbUser?.profilePic ?? '',
            agoraUid: callerUid,
            isAccepted: false,
            isAudioOnly,
            isMutedByHost: false,
            isCamAllowedByHost: !isAudioOnly,
            requestedAt: new Date(),
        });
        room.markModified('sideCallers');
        await room.save();
        _io?.to(channelName).emit('side_caller_request', {
            channelName,
            userId: me.id,
            username: dbUser?.username ?? me.username,
            profilePic: dbUser?.profilePic ?? '',
            agoraUid: callerUid,
            isAudioOnly,
        });
        res.status(200).json({ success: true, message: 'Side call request sent.' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.requestSideCaller = requestSideCaller;
// ─────────────────────────────────────────────
// 11. Side Caller: Accept (host only)
// ─────────────────────────────────────────────
const acceptSideCaller = async (req, res) => {
    try {
        const me = user(req);
        const channelName = param(req, 'channelName');
        const callerUid = parseInt(param(req, 'uid'), 10);
        const room = await live_model_1.default.findOne({ channelName, hostId: me.id, isActive: true });
        if (!room) {
            notFound(res, 'Active room not found or not owned by you.');
            return;
        }
        const caller = room.sideCallers.find((c) => c.agoraUid === callerUid);
        if (!caller) {
            notFound(res, 'Side caller not found.');
            return;
        }
        caller.isAccepted = true;
        room.markModified('sideCallers');
        await room.save();
        const tokenResult = await (0, agora_1.buildSeatToken)(channelName, caller.userId.toString());
        _io?.to(channelName).emit('side_caller_accepted', {
            channelName,
            userId: caller.userId.toString(),
            agoraUid: callerUid,
            token: tokenResult.token,
            isAudioOnly: caller.isAudioOnly,
        });
        _io?.to(channelName).emit('seat_state_changed', {
            channelName,
            sideCallers: room.sideCallers,
        });
        res.status(200).json({ success: true, caller, agora: tokenResult });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.acceptSideCaller = acceptSideCaller;
// ─────────────────────────────────────────────
// 12. Side Caller: Remove (host only)
// ─────────────────────────────────────────────
const removeSideCaller = async (req, res) => {
    try {
        const me = user(req);
        const channelName = param(req, 'channelName');
        const callerUid = parseInt(param(req, 'uid'), 10);
        const room = await live_model_1.default.findOne({ channelName, hostId: me.id, isActive: true });
        if (!room) {
            notFound(res, 'Active room not found or not owned by you.');
            return;
        }
        const callerIdx = room.sideCallers.findIndex((c) => c.agoraUid === callerUid);
        if (callerIdx === -1) {
            notFound(res, 'Side caller not found.');
            return;
        }
        const [removed] = room.sideCallers.splice(callerIdx, 1);
        room.markModified('sideCallers');
        await room.save();
        _io?.to(channelName).emit('side_caller_removed', {
            channelName,
            userId: removed.userId.toString(),
            agoraUid: callerUid,
        });
        _io?.to(channelName).emit('seat_state_changed', {
            channelName,
            sideCallers: room.sideCallers,
        });
        res.status(200).json({ success: true, message: 'Side caller removed.' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.removeSideCaller = removeSideCaller;
// ─────────────────────────────────────────────
// 13. Set VIP List (host only)
// ─────────────────────────────────────────────
/**
 * Host can update the full VIP list. Supports up to 7 tiers.
 * Existing VIPs are replaced entirely on each call.
 */
const setVips = async (req, res) => {
    try {
        const me = user(req);
        const channelName = param(req, 'channelName');
        const { vips } = req.body;
        if (!Array.isArray(vips)) {
            badRequest(res, 'vips must be an array.');
            return;
        }
        const room = await live_model_1.default.findOne({ channelName, hostId: me.id, isActive: true });
        if (!room) {
            notFound(res, 'Active room not found or not owned by you.');
            return;
        }
        room.vips = vips.map((v) => ({
            userId: new mongoose_1.default.Types.ObjectId(v.userId),
            username: v.username,
            profilePic: v.profilePic ?? '',
            tier: v.tier,
            tierLabel: v.tierLabel,
        }));
        await room.save();
        _io?.to(channelName).emit('vip_list_updated', {
            channelName,
            vips: room.vips,
        });
        res.status(200).json({ success: true, vips: room.vips });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.setVips = setVips;
