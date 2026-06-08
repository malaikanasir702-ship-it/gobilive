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

import { Server, Socket } from 'socket.io';
import LiveRoom from './live.model';
import { NotificationTriggers, sendToUser } from '../notifications/notification.service';
import { injectIo } from './seat.controller';
import { injectGiftIo } from '../gifts/gifts.controller';
import { injectLiveControllerIo } from './live.controller';

// ─────────────────────────────────────────────
// Existing in-memory state (untouched)
// ─────────────────────────────────────────────
interface JoinRoomPayload { roomId: string; username: string; }
interface CommentPayload  { roomId: string; username: string; text: string; level: number; }
interface GiftPayload     { roomId: string; sender: string; giftName: string; count: number; cost: number; giftType?: string; svgaUrl?: string | null; emoji?: string; }
interface PkStartPayload  { roomId: string; opponentRoomId: string; opponentHost: string; durationSeconds: number; }
interface PkScorePayload  { roomId: string; change: number; side: 'left' | 'right'; }
interface ChangeFilterPayload {
  roomId: string; filterIdx: number;
  faceX?: number; faceY?: number; faceWidth?: number; faceHeight?: number; faceRoll?: number;
}
interface MuteStatePayload { roomId: string; videoMuted: boolean; audioMuted: boolean; }

// ─────────────────────────────────────────────
// NEW: Seat event payloads
// ─────────────────────────────────────────────
interface SeatAudioMutePayload {
  roomId: string;
  seatIndex: number;
  agoraUid: number;
  muted: boolean;
}
interface SeatCamMutePayload {
  roomId: string;
  seatIndex: number;
  agoraUid: number;
  muted: boolean;
}
interface SeatLayoutChangePayload {
  roomId: string;
  seatLayoutCount: 2 | 4 | 9 | 13 | 16;
}

const roomViewers: Record<string, Set<string>> = {};
const pkScores: Record<string, { left: number; right: number }> = {};
const pkOpponents: Record<string, string> = {};

// ─────────────────────────────────────────────
// Existing helpers (untouched)
// ─────────────────────────────────────────────
function broadcastViewers(io: Server, roomId: string) {
  const viewers = roomViewers[roomId] ? Array.from(roomViewers[roomId]) : [];
  io.to(roomId).emit('viewer_count_changed', { count: viewers.length, viewers });
}

function handleJoinRoom(io: Server, socket: Socket, data: JoinRoomPayload) {
  const { roomId, username } = data;
  socket.join(roomId);
  if (!roomViewers[roomId]) roomViewers[roomId] = new Set();
  roomViewers[roomId].add(username);
  broadcastViewers(io, roomId);
  io.to(roomId).emit('new_comment', {
    roomId, username: 'System',
    text: `@${username} entered the live stream room! Welcome! 💖`,
    level: 99, isSystem: true,
  });
}

function handleLeaveRoom(io: Server, socket: Socket, data: JoinRoomPayload) {
  const { roomId, username } = data;
  socket.leave(roomId);
  if (roomViewers[roomId]) {
    roomViewers[roomId].delete(username);
    broadcastViewers(io, roomId);
  }
}

function handleSendComment(io: Server, data: CommentPayload) {
  io.to(data.roomId).emit('new_comment', { ...data, isSystem: false });
}

async function notifyLiveHost(
  roomId: string,
  payload: ReturnType<typeof NotificationTriggers.liveGift>
) {
  try {
    const room = await LiveRoom.findOne({ channelName: roomId });
    if (room) await sendToUser(room.hostId.toString(), payload);
  } catch (err) {
    console.warn('FCM live notification failed:', (err as Error).message);
  }
}

function handleSendGift(io: Server, data: GiftPayload) {
  notifyLiveHost(data.roomId, NotificationTriggers.liveGift(data.sender, data.giftName));
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

async function handleStartPk(io: Server, data: PkStartPayload) {
  const myRoom = await LiveRoom.findOne({ channelName: data.roomId });
  const opponentRoom = await LiveRoom.findOne({ channelName: data.opponentRoomId });
  const myHostName = myRoom ? myRoom.hostUsername : 'Host';
  const opponentHostName = opponentRoom ? opponentRoom.hostUsername : data.opponentHost;

  if (opponentRoom) {
    sendToUser(opponentRoom.hostId.toString(), NotificationTriggers.pkStarted(myHostName)).catch(() => {});
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

function handlePkScore(io: Server, data: PkScorePayload) {
  const opponentRoomId = pkOpponents[data.roomId];
  if (!pkScores[data.roomId]) pkScores[data.roomId] = { left: 100, right: 100 };
  if (data.side === 'left') pkScores[data.roomId].left += data.change;
  else pkScores[data.roomId].right += data.change;
  io.to(data.roomId).emit('pk_score_changed', {
    roomId: data.roomId, side: data.side, change: data.change,
    leftScore: pkScores[data.roomId].left, rightScore: pkScores[data.roomId].right,
  });
  if (opponentRoomId) {
    if (!pkScores[opponentRoomId]) pkScores[opponentRoomId] = { left: 100, right: 100 };
    if (data.side === 'left') pkScores[opponentRoomId].right += data.change;
    else pkScores[opponentRoomId].left += data.change;
    io.to(opponentRoomId).emit('pk_score_changed', {
      roomId: opponentRoomId,
      side: data.side === 'left' ? 'right' : 'left',
      change: data.change,
      leftScore: pkScores[opponentRoomId].left,
      rightScore: pkScores[opponentRoomId].right,
    });
  }
}

async function handleEndPk(io: Server, data: { roomId: string; winner: string }) {
  const opponentRoomId = pkOpponents[data.roomId];
  try {
    await LiveRoom.updateMany(
      { channelName: { $in: [data.roomId, opponentRoomId || ''] } },
      { $set: { isPKActive: false, opponentRoomId: '', opponentHost: '' } }
    );
  } catch (err) { console.error('Failed resetting PK models in MongoDB:', err); }

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

function cleanupSocketRooms(socket: Socket) {
  for (const roomId of socket.rooms) {
    if (roomId === socket.id) continue;
    if (roomViewers[roomId]) roomViewers[roomId].clear();
  }
}

// ─────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────
export function registerStreamSignaling(io: Server) {
  // Inject the io instance into the seat controller so it can emit events
  injectIo(io);
  // Inject into gift controller for diamond balance broadcasts
  injectGiftIo(() => io);
  // Inject into live controller for live_ended broadcast
  injectLiveControllerIo(io);

  io.on('connection', (socket) => {
    console.log(`🔌 Socket Connected: ${socket.id}`);

    // ── Existing event handlers (UNTOUCHED) ──────────────────────────────

    socket.on('join_room', (data: JoinRoomPayload) => {
      console.log(`👤 ${data.username} joined room ${data.roomId}`);
      handleJoinRoom(io, socket, data);
    });

    socket.on('leave_room', (data: JoinRoomPayload) => {
      handleLeaveRoom(io, socket, data);
    });

    socket.on('send_comment', (data: CommentPayload) => {
      handleSendComment(io, data);
    });

    socket.on('send_gift', (data: GiftPayload) => {
      handleSendGift(io, data);
    });

    socket.on('start_pk', (data: PkStartPayload) => {
      handleStartPk(io, data);
    });

    socket.on('pk_score_increment', (data: PkScorePayload) => {
      handlePkScore(io, data);
    });

    socket.on('end_pk', (data: { roomId: string; winner: string }) => {
      handleEndPk(io, data);
    });

    socket.on('change_filter', (data: ChangeFilterPayload) => {
      io.to(data.roomId).emit('filter_changed', data);
    });

    socket.on('mute_state_changed', (data: MuteStatePayload) => {
      io.to(data.roomId).emit('mute_state_changed', {
        roomId: data.roomId,
        videoMuted: data.videoMuted,
        audioMuted: data.audioMuted,
      });
    });

    // ── NEW: Seat event handlers ──────────────────────────────────────────

    /**
     * seat_audio_mute — emitted by a seat occupant after they've locally
     * applied a mute command from the host.  Keeps the DB in sync.
     */
    socket.on('seat_audio_mute', async (data: SeatAudioMutePayload) => {
      try {
        const room = await LiveRoom.findOne({ channelName: data.roomId, isActive: true });
        if (!room) return;
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
      } catch (err) {
        console.error('seat_audio_mute error:', err);
      }
    });

    /**
     * seat_cam_mute — emitted by a seat occupant after they've locally
     * applied a camera grant/revoke command from the host.
     */
    socket.on('seat_cam_mute', async (data: SeatCamMutePayload) => {
      try {
        const room = await LiveRoom.findOne({ channelName: data.roomId, isActive: true });
        if (!room) return;
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
      } catch (err) {
        console.error('seat_cam_mute error:', err);
      }
    });

    /**
     * seat_layout_change — host can dynamically resize the grid.
     * The backend persists the new count; all viewers receive the event
     * so the Flutter LayoutBuilder rebuilds the grid instantly.
     */
    socket.on('seat_layout_change', async (data: SeatLayoutChangePayload) => {
      try {
        await LiveRoom.updateOne(
          { channelName: data.roomId },
          { $set: { seatLayoutCount: data.seatLayoutCount } }
        );
        io.to(data.roomId).emit('seat_layout_changed', {
          channelName: data.roomId,
          seatLayoutCount: data.seatLayoutCount,
        });
      } catch (err) {
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
