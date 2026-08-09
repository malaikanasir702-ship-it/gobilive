"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const cloudinary_1 = require("cloudinary");
const logger_middleware_1 = require("./core/middlewares/logger.middleware");
const rate_limit_middleware_1 = require("./core/middlewares/rate-limit.middleware");
const auth_route_1 = __importDefault(require("./features/auth/auth.route"));
const leaderboard_route_1 = __importDefault(require("./features/leaderboard/leaderboard.route"));
const feed_route_1 = __importDefault(require("./features/feed/feed.route"));
const live_route_1 = __importDefault(require("./features/live/live.route"));
const wallet_route_1 = __importDefault(require("./features/wallet/wallet.route"));
const notification_route_1 = __importDefault(require("./features/notifications/notification.route"));
const search_route_1 = __importDefault(require("./features/search/search.route"));
const referral_route_1 = __importDefault(require("./features/referral/referral.route"));
const chat_route_1 = __importDefault(require("./features/chat/chat.route"));
const gifts_route_1 = __importDefault(require("./features/gifts/gifts.route"));
const agency_route_1 = __importDefault(require("./features/agency/agency.route"));
const coin_seller_route_1 = __importDefault(require("./features/coin-seller/coin-seller.route"));
const admin_route_1 = __importDefault(require("./features/admin/admin.route"));
const auth_route_2 = __importDefault(require("./features/admin-panel/auth.route"));
const video_call_route_1 = __importDefault(require("./features/video-call/video-call.route"));
const upload_route_1 = __importDefault(require("./features/upload/upload.route"));
const game_route_1 = __importDefault(require("./features/game/game.route"));
const story_route_1 = __importDefault(require("./features/story/story.route"));
const sound_route_1 = __importDefault(require("./features/sound/sound.route"));
const template_route_1 = __importDefault(require("./features/template/template.route"));
const support_ticket_route_1 = __importDefault(require("./features/support/support-ticket.route"));
const beans_route_1 = __importDefault(require("./features/beans/beans.route"));
const video_mix_route_1 = __importDefault(require("./features/video-mix/video-mix.route"));
const users_admin_route_1 = __importDefault(require("./features/admin/users-admin.route"));
const agencies_admin_route_1 = __importDefault(require("./features/admin/agencies-admin.route"));
const hosts_admin_route_1 = __importDefault(require("./features/admin/hosts-admin.route"));
const super_admins_route_1 = __importDefault(require("./features/admin/super-admins.route"));
const sub_admins_route_1 = __importDefault(require("./features/admin/sub-admins.route"));
const top_ups_route_1 = __importDefault(require("./features/admin/top-ups.route"));
const withdrawals_route_1 = __importDefault(require("./features/admin/withdrawals.route"));
const diamond_records_route_1 = __importDefault(require("./features/admin/diamond-records.route"));
const transactions_route_1 = __importDefault(require("./features/admin/transactions.route"));
const policies_route_1 = __importDefault(require("./features/admin/policies.route"));
const registration_route_1 = __importDefault(require("./features/admin/registration.route"));
const activity_logs_route_1 = __importDefault(require("./features/admin/activity-logs.route"));
const support_route_1 = __importDefault(require("./features/admin/support.route"));
const reports_route_1 = __importDefault(require("./features/admin/reports.route"));
const games_route_1 = __importDefault(require("./features/admin/games.route"));
const dashboard_admin_route_1 = __importDefault(require("./features/admin/dashboard-admin.route"));
const reels_admin_route_1 = __importDefault(require("./features/admin/reels-admin.route"));
const wallet_controller_1 = require("./features/wallet/wallet.controller");
// dotenv is loaded once in index.ts — this call is a safe no-op if already loaded.
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../.env') });
// --- Cloudinary Configuration ---
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
const app = (0, express_1.default)();
// ── Security Headers (helmet) ───────────────────────────────────────────────
// Must be first middleware. Relaxed CSP for admin panel SPA + Cloudinary images.
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false, // SPA + inline scripts need this disabled
    crossOriginEmbedderPolicy: false,
}));
// ── HTTP Request Logger (morgan → winston) ──────────────────────────────────
app.use(logger_middleware_1.httpLogger);
// --- CORS ---
// ALLOWED_ORIGINS env var accepts a comma-separated list of origins for tighter
// production control (e.g. "https://app.gobilive.com,https://admin.gobilive.com").
// If not set, we default to wildcard — suitable for public mobile API + dev builds.
// Note: wildcard (*) cannot be combined with `credentials: true` per the CORS spec,
// so credentials mode is only enabled when explicit origins are configured.
const rawOrigins = process.env.ALLOWED_ORIGINS;
const corsOrigin = rawOrigins
    ? rawOrigins.split(',').map((o) => o.trim())
    : '*';
const useCredentials = rawOrigins !== undefined && rawOrigins !== '';
app.use((0, cors_1.default)({
    origin: corsOrigin,
    credentials: useCredentials,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-api-key'],
}));
// ── General API Rate Limiter ────────────────────────────────────────────────
// Applied to all /api/* routes. Login-specific limiter is applied per route below.
app.use('/api/', rate_limit_middleware_1.apiLimiter);
// Stripe webhook needs raw body BEFORE the JSON parser — order matters.
app.post('/api/wallet/stripe/webhook', express_1.default.raw({ type: 'application/json' }), wallet_controller_1.stripeWebhook);
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Dynamic Role-Based Web App Manifest endpoint
app.get('/admin/manifest.json', (req, res) => {
    const role = req.query.role || 'default';
    const roleConfigs = {
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
app.use('/admin', express_1.default.static(path_1.default.join(__dirname, '../public/admin')));
app.use('/uploads', express_1.default.static(path_1.default.join(process.cwd(), 'uploads')));
// Serve landing page static assets (css, js if any)
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
// Landing page — root URL
app.get('/', (_req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../public/index.html'));
});
// SPA fallback — any /admin/* path that doesn't match a static file
// serves index.html so React Router handles it client-side
// Note: Express v5 requires named wildcard param — use '*path' not '*'
app.get('/admin/*path', (_req, res) => {
    const indexPath = path_1.default.join(__dirname, '../public/admin/index.html');
    res.sendFile(indexPath, (err) => {
        if (err)
            res.status(404).json({ success: false, message: 'Admin panel not built yet.' });
    });
});
app.use('/api/upload', upload_route_1.default);
app.use('/api/admin-panel/v1/upload', upload_route_1.default);
// Login rate limiter — applied specifically to auth login endpoints
app.use('/api/auth/login', rate_limit_middleware_1.loginLimiter);
app.use('/api/admin-panel/v1/auth/login', rate_limit_middleware_1.loginLimiter);
app.use('/api/auth', auth_route_1.default);
app.use('/api/leaderboard', leaderboard_route_1.default);
app.use('/api/feed', feed_route_1.default);
app.use('/api/live', live_route_1.default);
app.use('/api/wallet', wallet_route_1.default);
app.use('/api/notifications', notification_route_1.default);
app.use('/api/search', search_route_1.default);
app.use('/api/referral', referral_route_1.default);
app.use('/api/chat', chat_route_1.default);
app.use('/api/gifts', gifts_route_1.default);
app.use('/api/agency', agency_route_1.default);
app.use('/api/coin-seller', coin_seller_route_1.default);
app.use('/api/admin', admin_route_1.default);
app.use('/api/admin-panel/v1/auth', auth_route_2.default);
app.use('/api/video-call', video_call_route_1.default);
app.use('/api/game', game_route_1.default);
app.use('/api/story', story_route_1.default);
app.use('/api/sounds', sound_route_1.default);
app.use('/api/templates', template_route_1.default);
app.use('/api/support', support_ticket_route_1.default);
app.use('/api/beans', beans_route_1.default);
app.use('/api/video-mix', video_mix_route_1.default);
app.use('/api/admin-panel/v1/beans', beans_route_1.default);
app.use('/api/admin-panel/v1/users', users_admin_route_1.default);
app.use('/api/admin-panel/v1/agencies', agencies_admin_route_1.default);
app.use('/api/admin-panel/v1/hosts', hosts_admin_route_1.default);
app.use('/api/admin-panel/v1/super-admins', super_admins_route_1.default);
app.use('/api/admin-panel/v1/sub-admins', sub_admins_route_1.default);
app.use('/api/admin-panel/v1/top-ups', top_ups_route_1.default);
app.use('/api/admin-panel/v1/withdrawals', withdrawals_route_1.default);
app.use('/api/admin-panel/v1/diamonds', diamond_records_route_1.default);
app.use('/api/admin-panel/v1/transactions', transactions_route_1.default);
app.use('/api/admin-panel/v1/policies', policies_route_1.default);
app.use('/api/admin-panel/v1/registrations', registration_route_1.default);
app.use('/api/admin-panel/v1/activity-logs', activity_logs_route_1.default);
app.use('/api/admin-panel/v1/support', support_route_1.default);
app.use('/api/admin-panel/v1/reports', reports_route_1.default);
app.use('/api/admin-panel/v1/games', games_route_1.default);
app.use('/api/admin-panel/v1/dashboard', dashboard_admin_route_1.default);
app.use('/api/admin-panel/v1/reels', reels_admin_route_1.default);
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
app.use((err, _req, res, _next) => {
    console.error('🔥 Unhandled Server Error:', err.stack || err.message);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
    });
});
exports.default = app;
