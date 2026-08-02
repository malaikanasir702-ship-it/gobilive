"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const app_1 = __importDefault(require("./app"));
const db_1 = require("./config/db");
const stream_signaling_1 = require("./features/live/stream.signaling");
const chat_signaling_1 = require("./features/chat/chat.signaling");
const firebase_1 = require("./config/firebase");
const live_seed_1 = require("./features/live/live.seed");
const gifts_controller_1 = require("./features/gifts/gifts.controller");
const scheduler_1 = require("./core/cron/scheduler");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load .env once at the very top of the application.
// In production (Railway), env vars are injected directly — dotenv is a no-op there.
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../.env') });
// Dynamic port: Railway injects PORT automatically. Fallback to 5000 for local dev.
const PORT = parseInt(process.env.PORT || '5000', 10);
// --- HTTP Server ---
const server = http_1.default.createServer(app_1.default);
// --- Socket.IO Server ---
// Origin config mirrors the Express CORS policy in app.ts.
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : '*';
const io = new socket_io_1.Server(server, {
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
(0, stream_signaling_1.registerStreamSignaling)(io);
(0, chat_signaling_1.registerChatSignaling)(io);
// --- Startup Sequence ---
const startServer = async () => {
    try {
        (0, firebase_1.initFirebase)();
        await (0, db_1.connectDB)();
        await (0, live_seed_1.ensureLiveDiscoverySeed)();
        await (0, gifts_controller_1.seedGiftCatalogIfEmpty)();
        (0, scheduler_1.startCronJobs)();
        server.listen(PORT, () => {
            console.log(`🚀 Gobilive Server active on port ${PORT}`);
            console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🔗 Health Check: http://localhost:${PORT}/health`);
            console.log(`📡 Socket.IO signaling ready`);
        });
    }
    catch (err) {
        console.error('💥 Fatal startup error:', err);
        process.exit(1);
    }
};
// --- Graceful Shutdown ---
// Railway sends SIGTERM before killing the container — drain connections cleanly.
const shutdown = (signal) => {
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
