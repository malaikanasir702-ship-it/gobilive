import rateLimit from 'express-rate-limit';

/**
 * Login rate limiter — 10 attempts per 15 minutes per IP.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again after 15 minutes.' },
  skipSuccessfulRequests: true,
});

/**
 * General API rate limiter — 600 requests per minute per IP.
 * Covers authenticated endpoints (feed, profile, gifts/send, etc.)
 * Raised from 300 to accommodate 1000 concurrent mobile users.
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please slow down.' },
});

/**
 * Public read-only limiter — 1200 req/min per IP.
 * For catalog/discovery endpoints that are hit by every app open.
 * These are fully cached so DB load is ~0; generous limit is safe.
 */
export const publicReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests.' },
});

/**
 * Strict limiter for sensitive write operations (e.g., bean generation).
 * 30 requests per minute per IP.
 */
export const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Rate limit exceeded for this action.' },
});
