import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import authRouter from './features/auth/auth.route';
import feedRouter from './features/feed/feed.route';
import liveRouter from './features/live/live.route';
import walletRouter from './features/wallet/wallet.route';
import notificationRouter from './features/notifications/notification.route';
import searchRouter from './features/search/search.route';
import referralRouter from './features/referral/referral.route';
import chatRouter from './features/chat/chat.route';
import giftsRouter from './features/gifts/gifts.route';
import agencyRouter from './features/agency/agency.route';
import coinSellerRouter from './features/coin-seller/coin-seller.route';
import adminRouter from './features/admin/admin.route';
import videoCallRouter from './features/video-call/video-call.route';
import uploadRouter from './features/upload/upload.route';
import gameRouter from './features/game/game.route';
import { stripeWebhook } from './features/wallet/wallet.controller';

// dotenv is loaded once in index.ts — this call is a safe no-op if already loaded.
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();

// --- CORS ---
// ALLOWED_ORIGINS env var accepts a comma-separated list of origins for tighter
// production control (e.g. "https://app.gobilive.com,https://admin.gobilive.com").
// If not set, we default to wildcard — suitable for public mobile API + dev builds.
// Note: wildcard (*) cannot be combined with `credentials: true` per the CORS spec,
// so credentials mode is only enabled when explicit origins are configured.
const rawOrigins = process.env.ALLOWED_ORIGINS;
const corsOrigin: string | string[] | boolean = rawOrigins
  ? rawOrigins.split(',').map((o) => o.trim())
  : '*';
const useCredentials = rawOrigins !== undefined && rawOrigins !== '';

app.use(
  cors({
    origin: corsOrigin,
    credentials: useCredentials,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-api-key'],
  })
);

// Stripe webhook needs raw body BEFORE the JSON parser — order matters.
app.post(
  '/api/wallet/stripe/webhook',
  express.raw({ type: 'application/json' }),
  stripeWebhook as any
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/admin', express.static(path.join(__dirname, '../public/admin')));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use('/api/upload', uploadRouter);
app.use('/api/auth', authRouter);
app.use('/api/feed', feedRouter);
app.use('/api/live', liveRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/search', searchRouter);
app.use('/api/referral', referralRouter);
app.use('/api/chat', chatRouter);
app.use('/api/gifts', giftsRouter);
app.use('/api/agency', agencyRouter);
app.use('/api/coin-seller', coinSellerRouter);
app.use('/api/admin', adminRouter);
app.use('/api/video-call', videoCallRouter);
app.use('/api/game', gameRouter);

// Health Check — Railway uses this to verify the container is alive.
app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Gobilive backend is running.',
    environment: process.env.NODE_ENV || 'development',
    uptime: `${Math.floor(process.uptime())}s`,
  });
});

// 404 handler — catches unmatched routes before the error handler.
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// Global error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('🔥 Unhandled Server Error:', err.stack || err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

export default app;
