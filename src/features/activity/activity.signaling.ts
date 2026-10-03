/**
 * activity.signaling.ts
 *
 * Registers the activity-related Socket.IO events on the EXISTING io server.
 * Never creates a second connection.
 *
 * Users join a personal room `user_<userId>` after connecting so the server
 * can push real-time activity events to them.
 * This same room is used by activity.service.ts to emit `activity_new` events.
 */
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { injectActivityIo } from './activity.service';

function verifyToken(socket: Socket): { id: string; username: string } | null {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) return null;
  try {
    return jwt.verify(
      token,
      process.env.JWT_SECRET || 'super_secret_gobilive_token_key_123!'
    ) as { id: string; username: string };
  } catch {
    return null;
  }
}

export function registerActivitySignaling(io: Server) {
  // Inject io so activity.service.ts can emit without coupling
  injectActivityIo(io);

  io.on('connection', (socket) => {
    const user = verifyToken(socket);
    if (!user) return;

    // Join user's personal room for activity delivery
    socket.join(`user_${user.id}`);

    socket.on('activity_mark_read', async (data: { activityId: string }) => {
      if (!data?.activityId) return;
      try {
        const { markActivityRead } = await import('./activity.service');
        await markActivityRead(user.id, data.activityId);
      } catch (_) {}
    });

    socket.on('activity_mark_all_read', async () => {
      try {
        const { markAllActivitiesRead } = await import('./activity.service');
        await markAllActivitiesRead(user.id);
      } catch (_) {}
    });

    socket.on('disconnect', () => {
      socket.leave(`user_${user.id}`);
    });
  });

  console.log('📣 Activity signaling registered');
}
