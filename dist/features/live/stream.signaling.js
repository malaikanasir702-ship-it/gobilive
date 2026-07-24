"use strict";
/**
 * stream.signaling.ts
 *
 * Socket.IO signaling for the live streaming feature.
 *
 * ALL EXISTING EVENTS ARE COMPLETELY UNCHANGED.
 * New seat-management events are appended at the bottom of the handler
 * under clearly labelled sections so no existing code is disturbed.
 *
 * ─── Existing events (untouched) ───────────────────────────────────────────
 *  join_room, leave_room, send_comment, send_gift
 *  start_pk, pk_score_increment, end_pk
 *  change_filter, mute_state_changed
 *
 * ─── New seat events ────────────────────────────────────────────────────────
 *  seat_audio_mute     — Occupant confirms local audio mute state change
 *  seat_cam_mute       — Occupant confirms local video mute state change
 *  seat_layout_change  — Host broadcasts a new layout count to all viewers
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerStreamSignaling = registerStreamSignaling;
const live_model_1 = __importDefault(require("./live.model"));
const user_model_1 = require("../auth/user.model");
const notification_service_1 = require("../notifications/notification.service");
const seat_controller_1 = require("./seat.controller");
const gifts_controller_1 = require("../gifts/gifts.controller");
const live_controller_1 = require("./live.controller");
const roomViewers = {};
const pkScores = {};
const pkOpponents = {};
// ─────────────────────────────────────────────
// Existing helpers (untouched)
// ─────────────────────────────────────────────
function broadcastViewers(io, roomId) {
    const viewers = roomViewers[roomId] ? Array.from(roomViewers[roomId]) : [];
    io.to(roomId).emit('viewer_count_changed', { count: viewers.length, viewers });
}
function handleJoinRoom(io, socket, data) {
    const { roomId, username } = data;
    socket.join(roomId);
    if (!roomViewers[roomId])
        roomViewers[roomId] = new Set();
    roomViewers[roomId].add(username);
    broadcastViewers(io, roomId);
    io.to(roomId).emit('new_comment', {
        roomId, username: 'System',
        text: `@${username} entered the live stream room! Welcome! 💖`,
        level: 99, isSystem: true,
    });
}
function handleLeaveRoom(io, socket, data) {
    const { roomId, username } = data;
    socket.leave(roomId);
    if (roomViewers[roomId]) {
        roomViewers[roomId].delete(username);
        broadcastViewers(io, roomId);
    }
}
async function handleSendComment(io, data) {
    // Look up sender's role so badges can be shown on client
    let role = data.role ?? 'user';
    let profilePic = data.profilePic ?? '';
    try {
        const user = await user_model_1.User.findOne({ username: data.username })
            .select('role profilePic')
            .lean();
        if (user) {
            role = user.role ?? 'user';
            profilePic = user.profilePic ?? profilePic;
        }
    }
    catch (_) { /* non-critical */ }
    io.to(data.roomId).emit('new_comment', { ...data, isSystem: false, role, profilePic });
}
async function notifyLiveHost(roomId, payload) {
    try {
        const room = await live_model_1.default.findOne({ channelName: roomId });
        if (room)
            await (0, notification_service_1.sendToUser)(room.hostId.toString(), payload);
    }
    catch (err) {
        console.warn('FCM live notification failed:', err.message);
    }
}
function handleSendGift(io, data) {
    notifyLiveHost(data.roomId, notification_service_1.NotificationTriggers.liveGift(data.sender, data.giftName));
    io.to(data.roomId).emit('gift_received', data);
    io.to(data.roomId).emit('overlay_notification', {
        roomId: data.roomId, type: 'gift',
        title: `${data.sender} sent ${data.giftName}!`,
        subtitle: `x${data.count} · ${data.cost} diamonds`,
    });
    io.to(data.roomId).emit('new_comment', {
        roomId: data.roomId, username: 'Gift',
        text: `@${data.sender} sent Host a ${data.giftName}! 🎁✨`,
        level: 100, isSystem: true,
    });
}
async function handleStartPk(io, data) {
    const myRoom = await live_model_1.default.findOne({ channelName: data.roomId });
    const opponentRoom = await live_model_1.default.findOne({ channelName: data.opponentRoomId });
    const myHostName = myRoom ? myRoom.hostUsername : 'Host';
    const opponentHostName = opponentRoom ? opponentRoom.hostUsername : data.opponentHost;
    if (opponentRoom) {
        (0, notification_service_1.sendToUser)(opponentRoom.hostId.toString(), notification_service_1.NotificationTriggers.pkStarted(myHostName)).catch(() => { });
    }
    pkOpponents[data.roomId] = data.opponentRoomId;
    pkOpponents[data.opponentRoomId] = data.roomId;
    pkScores[data.roomId] = { left: 100, right: 100 };
    pkScores[data.opponentRoomId] = { left: 100, right: 100 };
    io.to(data.roomId).emit('pk_started', {
        opponentRoomId: data.opponentRoomId, opponentHost: opponentHostName,
        durationSeconds: data.durationSeconds, leftScore: 100, rightScore: 100,
    });
    io.to(data.roomId).emit('overlay_notification', {
        roomId: data.roomId, type: 'pk',
        title: 'PK Battle Started!', subtitle: `vs @${opponentHostName}`,
    });
    io.to(data.opponentRoomId).emit('pk_started', {
        opponentRoomId: data.roomId, opponentHost: myHostName,
        durationSeconds: data.durationSeconds, leftScore: 100, rightScore: 100,
    });
    io.to(data.opponentRoomId).emit('overlay_notification', {
        roomId: data.opponentRoomId, type: 'pk',
        title: 'PK Battle Started!', subtitle: `vs @${myHostName}`,
    });
}
function handlePkScore(io, data) {
    const opponentRoomId = pkOpponents[data.roomId];
    if (!pkScores[data.roomId])
        pkScores[data.roomId] = { left: 100, right: 100 };
    if (data.side === 'left')
        pkScores[data.roomId].left += data.change;
    else
        pkScores[data.roomId].right += data.change;
    io.to(data.roomId).emit('pk_score_changed', {
        roomId: data.roomId, side: data.side, change: data.change,
        leftScore: pkScores[data.roomId].left, rightScore: pkScores[data.roomId].right,
    });
    if (opponentRoomId) {
        if (!pkScores[opponentRoomId])
            pkScores[opponentRoomId] = { left: 100, right: 100 };
        if (data.side === 'left')
            pkScores[opponentRoomId].right += data.change;
        else
            pkScores[opponentRoomId].left += data.change;
        io.to(opponentRoomId).emit('pk_score_changed', {
            roomId: opponentRoomId,
            side: data.side === 'left' ? 'right' : 'left',
            change: data.change,
            leftScore: pkScores[opponentRoomId].left,
            rightScore: pkScores[opponentRoomId].right,
        });
    }
}
async function handleEndPk(io, data) {
    const opponentRoomId = pkOpponents[data.roomId];
    try {
        await live_model_1.default.updateMany({ channelName: { $in: [data.roomId, opponentRoomId || ''] } }, { $set: { isPKActive: false, opponentRoomId: '', opponentHost: '' } });
    }
    catch (err) {
        console.error('Failed resetting PK models in MongoDB:', err);
    }
    const scoreA = pkScores[data.roomId] || { left: 100, right: 100 };
    const winnerA = scoreA.left > scoreA.right ? 'left' : scoreA.left < scoreA.right ? 'right' : 'draw';
    delete pkScores[data.roomId];
    delete pkOpponents[data.roomId];
    if (opponentRoomId) {
        delete pkScores[opponentRoomId];
        delete pkOpponents[opponentRoomId];
    }
    io.to(data.roomId).emit('pk_ended', {
        roomId: data.roomId,
        winner: winnerA === 'left' ? 'You' : winnerA === 'right' ? data.winner : 'Draw',
    });
    io.to(data.roomId).emit('overlay_notification', {
        roomId: data.roomId, type: 'pk_end', title: 'PK Battle Over!',
        subtitle: winnerA === 'left' ? 'You Won! 🎉' : winnerA === 'right' ? `${data.winner} Won!` : 'It is a Draw!',
    });
    if (opponentRoomId) {
        const winnerB = winnerA === 'left' ? 'right' : winnerA === 'right' ? 'left' : 'draw';
        io.to(opponentRoomId).emit('pk_ended', {
            roomId: opponentRoomId,
            winner: winnerB === 'left' ? 'You' : winnerB === 'right' ? 'Opponent' : 'Draw',
        });
        io.to(opponentRoomId).emit('overlay_notification', {
            roomId: opponentRoomId, type: 'pk_end', title: 'PK Battle Over!',
            subtitle: winnerB === 'left' ? 'You Won! 🎉' : winnerB === 'right' ? 'Opponent Won!' : 'It is a Draw!',
        });
    }
}
function cleanupSocketRooms(socket) {
    for (const roomId of socket.rooms) {
        if (roomId === socket.id)
            continue;
        if (roomViewers[roomId])
            roomViewers[roomId].clear();
    }
}
// ─────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────
function registerStreamSignaling(io) {
    // Inject the io instance into the seat controller so it can emit events
    (0, seat_controller_1.injectIo)(io);
    // Inject into gift controller for diamond balance broadcasts
    (0, gifts_controller_1.injectGiftIo)(() => io);
    // Inject into live controller for live_ended broadcast
    (0, live_controller_1.injectLiveControllerIo)(io);
    io.on('connection', (socket) => {
        console.log(`🔌 Socket Connected: ${socket.id}`);
        // ── Existing event handlers (UNTOUCHED) ──────────────────────────────
        socket.on('join_room', (data) => {
            console.log(`👤 ${data.username} joined room ${data.roomId}`);
            handleJoinRoom(io, socket, data);
        });
        socket.on('leave_room', (data) => {
            handleLeaveRoom(io, socket, data);
        });
        socket.on('send_comment', (data) => {
            handleSendComment(io, data).catch(() => { });
        });
        socket.on('send_gift', (data) => {
            handleSendGift(io, data);
        });
        socket.on('start_pk', (data) => {
            handleStartPk(io, data);
        });
        socket.on('pk_score_increment', (data) => {
            handlePkScore(io, data);
        });
        socket.on('end_pk', (data) => {
            handleEndPk(io, data);
        });
        socket.on('change_filter', (data) => {
            io.to(data.roomId).emit('filter_changed', data);
        });
        socket.on('mute_state_changed', (data) => {
            io.to(data.roomId).emit('mute_state_changed', {
                roomId: data.roomId,
                videoMuted: data.videoMuted,
                audioMuted: data.audioMuted,
            });
        });
        // ── Heart burst (double-tap) ─────────────────────────────────────────────
        socket.on('send_heart', async (data) => {
            if (!data?.roomId)
                return;
            try {
                // Atomically increment and get new total
                const updated = await live_model_1.default.findOneAndUpdate({ channelName: data.roomId, isActive: true }, { $inc: { totalHearts: 1 } }, { new: true, select: 'totalHearts' });
                const totalHearts = updated?.totalHearts ?? 1;
                // Broadcast to everyone in the room (including sender for sync)
                io.to(data.roomId).emit('heart_received', {
                    roomId: data.roomId,
                    username: data.username,
                    totalHearts,
                });
            }
            catch (_) {
                // Non-critical — fire and forget
            }
        });
        // ── NEW: Seat event handlers ──────────────────────────────────────────
        /**
         * seat_audio_mute — emitted by a seat occupant after they've locally
         * applied a mute command from the host.  Keeps the DB in sync.
         */
        socket.on('seat_audio_mute', async (data) => {
            try {
                const room = await live_model_1.default.findOne({ channelName: data.roomId, isActive: true });
                if (!room)
                    return;
                const seat = room.seats.find((s) => s.seatIndex === data.seatIndex);
                if (seat) {
                    seat.isMutedByHost = data.muted;
                    room.markModified('seats');
                    await room.save();
                }
                // Re-broadcast so all clients reflect the confirmed state
                io.to(data.roomId).emit('seat_state_changed', {
                    channelName: data.roomId,
                    seats: room.seats,
                });
            }
            catch (err) {
                console.error('seat_audio_mute error:', err);
            }
        });
        /**
         * seat_cam_mute — emitted by a seat occupant after they've locally
         * applied a camera grant/revoke command from the host.
         */
        socket.on('seat_cam_mute', async (data) => {
            try {
                const room = await live_model_1.default.findOne({ channelName: data.roomId, isActive: true });
                if (!room)
                    return;
                const seat = room.seats.find((s) => s.seatIndex === data.seatIndex);
                if (seat) {
                    seat.isAudioOnly = data.muted; // muted video ↔ audio-only
                    room.markModified('seats');
                    await room.save();
                }
                io.to(data.roomId).emit('seat_state_changed', {
                    channelName: data.roomId,
                    seats: room.seats,
                });
            }
            catch (err) {
                console.error('seat_cam_mute error:', err);
            }
        });
        /**
         * seat_layout_change — host can dynamically resize the grid.
         * The backend persists the new count; all viewers receive the event
         * so the Flutter LayoutBuilder rebuilds the grid instantly.
         */
        socket.on('seat_layout_change', async (data) => {
            try {
                await live_model_1.default.updateOne({ channelName: data.roomId }, { $set: { seatLayoutCount: data.seatLayoutCount } });
                io.to(data.roomId).emit('seat_layout_changed', {
                    channelName: data.roomId,
                    seatLayoutCount: data.seatLayoutCount,
                });
            }
            catch (err) {
                console.error('seat_layout_change error:', err);
            }
        });
        // ── Disconnect cleanup (untouched logic + seat cleanup) ──────────────
        socket.on('disconnect', () => {
            cleanupSocketRooms(socket);
            console.log(`🔌 Socket Disconnected: ${socket.id}`);
        });
    });
    console.log('📡 Stream signaling channel registered');
}
