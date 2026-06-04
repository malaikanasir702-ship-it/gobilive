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

// Load .env once at the very top of the application.
// In production (Railway), env vars are injected directly — dotenv is a no-op there.
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Dynamic port: Railway injects PORT automatically. Fallback to 5000 for local dev.
const PORT = parseInt(process.env.PORT || '5000', 10);

// --- HTTP Server ---
const server = http.createServer(app);

// --- Socket.IO Server ---
// Origin config mirrors the Express CORS policy in app.ts.
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : '*';

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: allowedOrigins !== '*',
  },
  // Tune transports for mobile clients (Flutter). Long-polling fallback keeps
  // connections alive behind aggressive NAT/firewalls on mobile networks.
  transports: ['websocket', 'polling'],
  // Ping settings keep the connection alive across Railway's 30-second idle timeout
  pingTimeout: 60000,
  pingInterval: 25000,
});

registerStreamSignaling(io);
registerChatSignaling(io);

// --- Startup Sequence ---
const startServer = async () => {
  try {
    initFirebase();
    await connectDB();
    await ensureLiveDiscoverySeed();

    server.listen(PORT, () => {
      console.log(`🚀 Gobilive Server active on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health Check: http://localhost:${PORT}/health`);
      console.log(`📡 Socket.IO signaling ready`);
    });
  } catch (err) {
    console.error('💥 Fatal startup error:', err);
    process.exit(1);
  }
};

// --- Graceful Shutdown ---
// Railway sends SIGTERM before killing the container — drain connections cleanly.
const shutdown = (signal: string) => {
  console.log(`\n⚡ ${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log('✅ HTTP server closed.');
    process.exit(0);
  });
  // Force exit if still hanging after 10 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout.');
    process.exit(1);
  }, 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startServer();
