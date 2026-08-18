import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import { httpLogger } from './core/middlewares/logger.middleware';
import { loginLimiter, apiLimiter } from './core/middlewares/rate-limit.middleware';
import authRouter from './features/auth/auth.route';
import { forgotPassword, resetPassword, findMyAccount, sendAccountRecoveryOtp, verifyOtpAndResetPassword } from './features/auth/auth.controller';
import leaderboardRouter from './features/leaderboard/leaderboard.route';
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
import storyRouter from './features/story/story.route';
import soundRouter from './features/sound/sound.route';
import templateRouter from './features/template/template.route';
import supportTicketRouter from './features/support/support-ticket.route';
import beansRouter from './features/beans/beans.route';
import videoMixRouter from './features/video-mix/video-mix.route';
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
import reelsAdminRouter from './features/admin/reels-admin.route';
import framesRouter from './features/frames/frames.route';
import { stripeWebhook } from './features/wallet/wallet.controller';

// dotenv is loaded once in index.ts — this call is a safe no-op if already loaded.
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// --- Cloudinary Configuration ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();

// ── Security Headers (helmet) ───────────────────────────────────────────────
// Must be first middleware. Relaxed CSP for admin panel SPA + Cloudinary images.
app.use(
  helmet({
    contentSecurityPolicy: false, // SPA + inline scripts need this disabled
    crossOriginEmbedderPolicy: false,
  })
);

// ── HTTP Request Logger (morgan → winston) ──────────────────────────────────
app.use(httpLogger);

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

// ── General API Rate Limiter ────────────────────────────────────────────────
// Applied to all /api/* routes. Login-specific limiter is applied per route below.
app.use('/api/', apiLimiter);

// Stripe webhook needs raw body BEFORE the JSON parser — order matters.
app.post(
  '/api/wallet/stripe/webhook',
  express.raw({ type: 'application/json' }),
  stripeWebhook as any
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Dynamic Role-Based Web App Manifest endpoint
app.get('/admin/manifest.json', (req, res) => {
  const role = (req.query.role as string) || 'default';

  const roleConfigs: Record<string, { name: string; shortName: string; themeColor: string; shortcuts: any[] }> = {
    super_admin: {
      name: 'Globilive Super Admin',
      shortName: 'Super Admin',
      themeColor: '#7c3aed',
      shortcuts: [
        { name: 'Super Admin Dashboard', short_name: 'Dashboard', description: 'Main Admin Dashboard', url: '/admin/dashboard' },
        { name: 'Sub Admins List', short_name: 'Sub Admins', description: 'Manage Sub Admins', url: '/admin/sub-admins' },
        { name: 'Cash Out Approvals', short_name: 'Cash Out', description: 'Review Cashouts', url: '/admin/cash-out' },
        { name: 'Pending Registrations', short_name: 'Registrations', description: 'Review registrations', url: '/admin/registrations' },
      ],
    },
    company_admin: {
      name: 'Globilive Company Admin',
      shortName: 'Company Admin',
      themeColor: '#0284c7',
      shortcuts: [
        { name: 'Company Dashboard', short_name: 'Dashboard', description: 'Overview & metrics', url: '/admin/dashboard' },
        { name: 'Beans Management', short_name: 'Beans', description: 'Bean balances & logs', url: '/admin/beans' },
        { name: 'Agencies List', short_name: 'Agencies', description: 'Manage registered agencies', url: '/admin/agencies' },
        { name: 'Top-Ups & Resellers', short_name: 'Top-Ups', description: 'Manage topup agents', url: '/admin/top-ups-resellers' },
      ],
    },
    sub_admin: {
      name: 'Globilive Sub Admin',
      shortName: 'Sub Admin',
      themeColor: '#6d28d9',
      shortcuts: [
        { name: 'Sub Admin Dashboard', short_name: 'Dashboard', description: 'Overview', url: '/admin/dashboard' },
        { name: 'User Management', short_name: 'Users', description: 'Users directory', url: '/admin/users' },
        { name: 'Hosts Management', short_name: 'Hosts', description: 'Hosts directory', url: '/admin/hosts' },
      ],
    },
    agency: {
      name: 'Globilive Agency Portal',
      shortName: 'Agency Portal',
      themeColor: '#059669',
      shortcuts: [
        { name: 'Agency Dashboard', short_name: 'Dashboard', description: 'Agency overview', url: '/admin/dashboard' },
        { name: 'Agency Hosts', short_name: 'Hosts', description: 'Agency hosts list', url: '/admin/hosts' },
        { name: 'Agency Users', short_name: 'Users', description: 'Agency user list', url: '/admin/users' },
      ],
    },
    sub_agency: {
      name: 'Globilive Sub-Agency',
      shortName: 'Sub-Agency',
      themeColor: '#0d9488',
      shortcuts: [
        { name: 'Sub-Agency Dashboard', short_name: 'Dashboard', description: 'Overview', url: '/admin/dashboard' },
        { name: 'Sub-Agency Hosts', short_name: 'Hosts', description: 'Hosts list', url: '/admin/hosts' },
      ],
    },
    top_up_agent: {
      name: 'Globilive Topup Agent',
      shortName: 'Topup Agent',
      themeColor: '#d97706',
      shortcuts: [
        { name: 'Topup Agent Dashboard', short_name: 'Dashboard', description: 'Overview', url: '/admin/dashboard' },
        { name: 'Bean Request', short_name: 'Bean Request', description: 'Request new beans', url: '/admin/bean-request' },
        { name: 'Bean Transfer', short_name: 'Bean Transfer', description: 'Transfer beans to reseller', url: '/admin/bean-transfer' },
        { name: 'Resellers List', short_name: 'Resellers', description: 'Manage resellers', url: '/admin/resellers' },
      ],
    },
    reseller: {
      name: 'Globilive Reseller Portal',
      shortName: 'Reseller',
      themeColor: '#ca8a04',
      shortcuts: [
        { name: 'Reseller Dashboard', short_name: 'Dashboard', description: 'Overview', url: '/admin/dashboard' },
        { name: 'Bean Request', short_name: 'Bean Request', description: 'Request beans', url: '/admin/bean-request' },
        { name: 'Bean Transfer', short_name: 'Bean Transfer', description: 'Transfer beans', url: '/admin/bean-transfer' },
      ],
    },
  };

  const config = roleConfigs[role] || {
    name: 'Globilive Admin',
    shortName: 'Globilive Admin',
    themeColor: '#2563eb',
    shortcuts: [],
  };

  res.setHeader('Content-Type', 'application/manifest+json');
  res.setHeader('Cache-Control', 'no-cache');
  res.json({
    id: `/admin/?role=${role}`,
    name: config.name,
    short_name: config.shortName,
    description: `Add ${config.shortName} shortcut to home screen`,
    start_url: `/admin/dashboard?role=${role}`,
    scope: `/admin/?role=${role}`,
    display: 'standalone',
    orientation: 'any',
    background_color: '#0f0f1a',
    theme_color: config.themeColor,
    icons: [
      {
        src: '/admin/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/admin/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
    shortcuts: config.shortcuts.map((s) => ({
      name: s.name,
      short_name: s.short_name,
      description: s.description,
      url: s.url,
      icons: [{ src: '/admin/icons/icon-192.png', sizes: '192x192' }],
    })),
  });
});

app.use('/admin', express.static(path.join(__dirname, '../public/admin')));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Serve landing page static assets (css, js if any)
app.use(express.static(path.join(__dirname, '../public')));

// Landing page — root URL
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// SPA fallback — any /admin/* path that doesn't match a static file
// serves index.html so React Router handles it client-side
// Note: Express v5 requires named wildcard param — use '*path' not '*'
app.get('/admin/*path', (_req, res) => {
  const indexPath = path.join(__dirname, '../public/admin/index.html');
  res.sendFile(indexPath, (err) => {
    if (err) res.status(404).json({ success: false, message: 'Admin panel not built yet.' });
  });
});

app.use('/api/upload', uploadRouter);
app.use('/api/admin-panel/v1/upload', uploadRouter);
// Login rate limiter — applied specifically to auth login endpoints
app.use('/api/auth/login', loginLimiter);
app.use('/api/admin-panel/v1/auth/login', loginLimiter);
app.use('/api/auth', authRouter);
app.post('/api/forgot-password', forgotPassword as any);
app.post('/api/forgot_password', forgotPassword as any);
app.post('/api/reset-password', resetPassword as any);
app.post('/api/reset_password', resetPassword as any);
// Find My Account fallback routes (also available under /api/auth/*)
app.post('/api/find-account', findMyAccount as any);
app.post('/api/send-recovery-otp', sendAccountRecoveryOtp as any);
app.post('/api/verify-otp-reset', verifyOtpAndResetPassword as any);
app.use('/api/leaderboard', leaderboardRouter);
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
app.use('/api/story', storyRouter);
app.use('/api/sounds', soundRouter);
app.use('/api/templates', templateRouter);
app.use('/api/support', supportTicketRouter);
app.use('/api/beans', beansRouter);
app.use('/api/video-mix', videoMixRouter);
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
app.use('/api/admin-panel/v1/reels', reelsAdminRouter);
app.use('/api/frames', framesRouter);
app.use('/api/admin-panel/v1/frames', framesRouter);

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
