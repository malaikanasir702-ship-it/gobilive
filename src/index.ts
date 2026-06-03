import http from 'http';
import { Server } from 'socket.io';
import app from './app';
import { connectDB } from './config/db';
import { registerStreamSignaling } from './features/live/stream.signaling';
import { registerChatSignaling } from './features/chat/chat.signaling';
import { initFirebase } from './config/firebase';
import { ensureLiveDiscoverySeed } from './features/live/live.seed';
import dotenv from 'dotenv';
import path from 'path';

// Ensure .env is loaded correctly in both src (dev) and dist (start)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

registerStreamSignaling(io);
registerChatSignaling(io);

const startServer = async () => {
  initFirebase();
  await connectDB();
  await ensureLiveDiscoverySeed();

  server.listen(PORT, () => {
    console.log(`🚀 Gobilive Server active on port ${PORT}`);
    console.log(`🔗 Health Check: http://localhost:${PORT}/health`);
    console.log(`📡 Socket.IO signaling ready`);
  });
};

startServer();
