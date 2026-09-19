"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.strictLimiter = exports.publicReadLimiter = exports.apiLimiter = exports.loginLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
/**
 * Login rate limiter — 10 attempts per 15 minutes per IP.
 */
exports.loginLimiter = (0, express_rate_limit_1.default)({
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
exports.apiLimiter = (0, express_rate_limit_1.default)({
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
exports.publicReadLimiter = (0, express_rate_limit_1.default)({
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
exports.strictLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Rate limit exceeded for this action.' },
});
