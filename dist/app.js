"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const cloudinary_1 = require("cloudinary");
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
// Stripe webhook needs raw body BEFORE the JSON parser — order matters.
app.post('/api/wallet/stripe/webhook', express_1.default.raw({ type: 'application/json' }), wallet_controller_1.stripeWebhook);
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
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
