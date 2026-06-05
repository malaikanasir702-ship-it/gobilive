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
import adminPanelAuthRouter from './features/admin-panel/auth.route';
import videoCallRouter from './features/video-call/video-call.route';
import uploadRouter from './features/upload/upload.route';
import gameRouter from './features/game/game.route';
import beansRouter from './features/beans/beans.route';
import usersAdminRouter from './features/admin/users-admin.route';
import agenciesAdminRouter from './features/admin/agencies-admin.route';
import hostsAdminRouter from './features/admin/hosts-admin.route';
import superAdminsRouter from './features/admin/super-admins.route';
import subAdminsRouter from './features/admin/sub-admins.route';
import topUpsRouter from './features/admin/top-ups.route';
import withdrawalsRouter from './features/admin/withdrawals.route';
import diamondRecordsRouter from './features/admin/diamond-records.route';
import transactionsRouter from './features/admin/transactions.route';
import policiesRouter from './features/admin/policies.route';
import registrationRouter from './features/admin/registration.route';
import activityLogsRouter from './features/admin/activity-logs.route';
import supportRouter from './features/admin/support.route';
import reportsRouter from './features/admin/reports.route';
import gamesRouter from './features/admin/games.route';
import dashboardAdminRouter from './features/admin/dashboard-admin.route';
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

// SPA fallback — any /admin/* path that doesn't match a static file
// serves index.html so React Router handles it client-side
app.get('/admin/*', (_req, res) => {
  const indexPath = path.join(__dirname, '../public/admin/index.html');
  res.sendFile(indexPath, (err) => {
    if (err) res.status(404).json({ success: false, message: 'Admin panel not built yet.' });
  });
});

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
app.use('/api/admin-panel/v1/auth', adminPanelAuthRouter);
app.use('/api/video-call', videoCallRouter);
app.use('/api/game', gameRouter);
app.use('/api/admin-panel/v1/beans', beansRouter);
app.use('/api/admin-panel/v1/users', usersAdminRouter);
app.use('/api/admin-panel/v1/agencies', agenciesAdminRouter);
app.use('/api/admin-panel/v1/hosts', hostsAdminRouter);
app.use('/api/admin-panel/v1/super-admins', superAdminsRouter);
app.use('/api/admin-panel/v1/sub-admins', subAdminsRouter);
app.use('/api/admin-panel/v1/top-ups', topUpsRouter);
app.use('/api/admin-panel/v1/withdrawals', withdrawalsRouter);
app.use('/api/admin-panel/v1/diamonds', diamondRecordsRouter);
app.use('/api/admin-panel/v1/transactions', transactionsRouter);
app.use('/api/admin-panel/v1/policies', policiesRouter);
app.use('/api/admin-panel/v1/registrations', registrationRouter);
app.use('/api/admin-panel/v1/activity-logs', activityLogsRouter);
app.use('/api/admin-panel/v1/support', supportRouter);
app.use('/api/admin-panel/v1/reports', reportsRouter);
app.use('/api/admin-panel/v1/games', gamesRouter);
app.use('/api/admin-panel/v1/dashboard', dashboardAdminRouter);

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
