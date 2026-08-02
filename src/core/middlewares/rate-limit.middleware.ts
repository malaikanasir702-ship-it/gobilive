import rateLimit from 'express-rate-limit';

/**
 * Login rate limiter — 10 attempts per 15 minutes per IP.
 * Applied on /api/auth/login and /api/admin-panel/v1/auth/login.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.',
  },
  skipSuccessfulRequests: true, // only count failed attempts
});

/**
 * General API rate limiter — 300 requests per minute per IP.
 * Applied on all /api/* routes.
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please slow down.',
  },
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
  message: {
    success: false,
    message: 'Rate limit exceeded for this action.',
  },
});
