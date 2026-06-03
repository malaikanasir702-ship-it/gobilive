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

// Ensure .env is loaded correctly in both src (dev) and dist (start)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();

app.use(cors({
  origin: '*',
  credentials: true,
}));

// Stripe webhook needs raw body before JSON parser
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

// Basic Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    success: true, 
    message: 'Gobilive Node.js Backend is running smooth.', 
    uptime: `${Math.floor(process.uptime())}s` 
  });
});

// Global API Error Handler Middleware
app.use((err: any, req: any, res: any, next: any) => {
  console.error('🔥 Server Error Catch:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

export default app;
