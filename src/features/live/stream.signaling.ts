import { Server, Socket } from 'socket.io';
import LiveRoom from './live.model';
import { NotificationTriggers, sendToUser } from '../notifications/notification.service';

interface JoinRoomPayload {
  roomId: string;
  username: string;
}

interface CommentPayload {
  roomId: string;
  username: string;
  text: string;
  level: number;
}

interface GiftPayload {
  roomId: string;
  sender: string;
  giftName: string;
  count: number;
  cost: number;
}

interface PkStartPayload {
  roomId: string;
  opponentRoomId: string;
  opponentHost: string;
  durationSeconds: number;
}

interface PkScorePayload {
  roomId: string;
  change: number;
  side: 'left' | 'right';
}

interface ChangeFilterPayload {
  roomId: string;
  filterIdx: number;
  faceX?: number;
  faceY?: number;
  faceWidth?: number;
  faceHeight?: number;
  faceRoll?: number;
}

interface MuteStatePayload {
  roomId: string;
  videoMuted: boolean;
  audioMuted: boolean;
}

const roomViewers: Record<string, Set<string>> = {};
const pkScores: Record<string, { left: number; right: number }> = {};
const pkOpponents: Record<string, string> = {};

function broadcastViewers(io: Server, roomId: string) {
  const viewers = roomViewers[roomId] ? Array.from(roomViewers[roomId]) : [];
  io.to(roomId).emit('viewer_count_changed', {
    count: viewers.length,
    viewers,
  });
}

function handleJoinRoom(io: Server, socket: Socket, data: JoinRoomPayload) {
  const { roomId, username } = data;
  socket.join(roomId);

  if (!roomViewers[roomId]) {
    roomViewers[roomId] = new Set();
  }
  roomViewers[roomId].add(username);

  broadcastViewers(io, roomId);

  io.to(roomId).emit('new_comment', {
    roomId,
    username: 'System',
    text: `@${username} entered the live stream room! Welcome! 💖`,
    level: 99,
    isSystem: true,
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

async function notifyLiveHost(roomId: string, payload: ReturnType<typeof NotificationTriggers.liveGift>) {
  try {
    const room = await LiveRoom.findOne({ channelName: roomId });
    if (room) {
      await sendToUser(room.hostId.toString(), payload);
    }
  } catch (err) {
    console.warn('FCM live notification failed:', (err as Error).message);
  }
}

function handleSendGift(io: Server, data: GiftPayload) {
  notifyLiveHost(
    data.roomId,
    NotificationTriggers.liveGift(data.sender, data.giftName)
  );
  io.to(data.roomId).emit('gift_received', data);
  io.to(data.roomId).emit('overlay_notification', {
    roomId: data.roomId,
    type: 'gift',
    title: `${data.sender} sent ${data.giftName}!`,
    subtitle: `x${data.count} · ${data.cost} diamonds`,
  });
  io.to(data.roomId).emit('new_comment', {
    roomId: data.roomId,
    username: 'Gift',
    text: `@${data.sender} sent Host a ${data.giftName}! 🎁✨`,
    level: 100,
    isSystem: true,
  });
}

async function handleStartPk(io: Server, data: PkStartPayload) {
  const myRoom = await LiveRoom.findOne({ channelName: data.roomId });
  const opponentRoom = await LiveRoom.findOne({ channelName: data.opponentRoomId });

  const myHostName = myRoom ? myRoom.hostUsername : 'Host';
  const opponentHostName = opponentRoom ? opponentRoom.hostUsername : data.opponentHost;

  if (opponentRoom) {
    sendToUser(
      opponentRoom.hostId.toString(),
      NotificationTriggers.pkStarted(myHostName)
    ).catch(() => {});
  }

  // Register the dual connection mapping
  pkOpponents[data.roomId] = data.opponentRoomId;
  pkOpponents[data.opponentRoomId] = data.roomId;

  // Initialize scores symmetrically
  pkScores[data.roomId] = { left: 100, right: 100 };
  pkScores[data.opponentRoomId] = { left: 100, right: 100 };

  // Notify initiator room A
  io.to(data.roomId).emit('pk_started', {
    opponentRoomId: data.opponentRoomId,
    opponentHost: opponentHostName,
    durationSeconds: data.durationSeconds,
    leftScore: 100,
    rightScore: 100,
  });
  io.to(data.roomId).emit('overlay_notification', {
    roomId: data.roomId,
    type: 'pk',
    title: 'PK Battle Started!',
    subtitle: `vs @${opponentHostName}`,
  });

  // Notify opponent room B
  io.to(data.opponentRoomId).emit('pk_started', {
    opponentRoomId: data.roomId,
    opponentHost: myHostName,
    durationSeconds: data.durationSeconds,
    leftScore: 100,
    rightScore: 100,
  });
  io.to(data.opponentRoomId).emit('overlay_notification', {
    roomId: data.opponentRoomId,
    type: 'pk',
    title: 'PK Battle Started!',
    subtitle: `vs @${myHostName}`,
  });
}

function handlePkScore(io: Server, data: PkScorePayload) {
  const opponentRoomId = pkOpponents[data.roomId];

  if (!pkScores[data.roomId]) {
    pkScores[data.roomId] = { left: 100, right: 100 };
  }

  // Update initiator/source room score
  if (data.side === 'left') {
    pkScores[data.roomId].left += data.change;
  } else {
    pkScores[data.roomId].right += data.change;
  }

  io.to(data.roomId).emit('pk_score_changed', {
    roomId: data.roomId,
    side: data.side,
    change: data.change,
    leftScore: pkScores[data.roomId].left,
    rightScore: pkScores[data.roomId].right,
  });

  // Update target/opponent room score symmetrically (swap sides)
  if (opponentRoomId) {
    if (!pkScores[opponentRoomId]) {
      pkScores[opponentRoomId] = { left: 100, right: 100 };
    }

    if (data.side === 'left') {
      pkScores[opponentRoomId].right += data.change;
    } else {
      pkScores[opponentRoomId].left += data.change;
    }

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

  // Symmetrically reset MongoDB room values
  try {
    await LiveRoom.updateMany(
      { channelName: { $in: [data.roomId, opponentRoomId || ''] } },
      { $set: { isPKActive: false, opponentRoomId: '', opponentHost: '' } }
    );
  } catch (err) {
    console.error('Failed resetting PK models in MongoDB:', err);
  }

  const scoreA = pkScores[data.roomId] || { left: 100, right: 100 };
  const winnerA = scoreA.left > scoreA.right ? 'left' : scoreA.left < scoreA.right ? 'right' : 'draw';

  // Cleanup mappings & scores
  delete pkScores[data.roomId];
  delete pkOpponents[data.roomId];
  if (opponentRoomId) {
    delete pkScores[opponentRoomId];
    delete pkOpponents[opponentRoomId];
  }

  // Notify Room A
  io.to(data.roomId).emit('pk_ended', {
    roomId: data.roomId,
    winner: winnerA === 'left' ? 'You' : winnerA === 'right' ? data.winner : 'Draw',
  });
  io.to(data.roomId).emit('overlay_notification', {
    roomId: data.roomId,
    type: 'pk_end',
    title: 'PK Battle Over!',
    subtitle: winnerA === 'left' ? 'You Won! 🎉' : winnerA === 'right' ? `${data.winner} Won!` : 'It is a Draw!',
  });

  // Notify Room B
  if (opponentRoomId) {
    const winnerB = winnerA === 'left' ? 'right' : winnerA === 'right' ? 'left' : 'draw';
    io.to(opponentRoomId).emit('pk_ended', {
      roomId: opponentRoomId,
      winner: winnerB === 'left' ? 'You' : winnerB === 'right' ? 'Opponent' : 'Draw',
    });
    io.to(opponentRoomId).emit('overlay_notification', {
      roomId: opponentRoomId,
      type: 'pk_end',
      title: 'PK Battle Over!',
      subtitle: winnerB === 'left' ? 'You Won! 🎉' : winnerB === 'right' ? 'Opponent Won!' : 'It is a Draw!',
    });
  }
}

function cleanupSocketRooms(socket: Socket) {
  for (const roomId of socket.rooms) {
    if (roomId === socket.id) continue;
    if (roomViewers[roomId]) {
      roomViewers[roomId].clear();
    }
  }
}

export function registerStreamSignaling(io: Server) {
  io.on('connection', (socket) => {
    console.log(`🔌 Socket Connected: ${socket.id}`);

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

    socket.on('disconnect', () => {
      cleanupSocketRooms(socket);
      console.log(`🔌 Socket Disconnected: ${socket.id}`);
    });
  });

  console.log('📡 Stream signaling channel registered');
}
