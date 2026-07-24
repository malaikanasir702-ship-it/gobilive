"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../core/middlewares/auth.middleware");
const gifts_controller_1 = require("./gifts.controller");
const router = (0, express_1.Router)();
// ── Public / authenticated ──────────────────────────────────────────────────
router.get('/catalog', gifts_controller_1.getGiftCatalog);
router.post('/send', auth_middleware_1.authenticateJWT, gifts_controller_1.sendGiftToHost);
router.post('/purchase', auth_middleware_1.authenticateJWT, gifts_controller_1.purchaseGiftItem);
// ── Admin-only gift management ───────────────────────────────────────────────
// Admin catalog: returns ALL gifts including inactive ones
router.get('/admin/catalog-all', auth_middleware_1.authenticateJWT, gifts_controller_1.requireAdminJwt, async (_req, res) => {
    const { Gift } = await Promise.resolve().then(() => __importStar(require('./gift.model')));
    const gifts = await Gift.find().sort({ sortOrder: 1, createdAt: 1 }).lean();
    const normalised = gifts.map((g) => ({
        id: g.id, name: g.name, emoji: g.emoji,
        diamondCost: g.diamondCost, rcoinEarned: g.rcoinEarned,
        isVipOnly: g.isVipOnly, animation: g.animation,
        giftType: g.giftType, svgaUrl: g.svgaUrl ?? null,
        isActive: g.isActive, sortOrder: g.sortOrder,
    }));
    res.status(200).json({ success: true, gifts: normalised });
});
// ── Admin-only gift management ───────────────────────────────────────────────
router.post('/admin/create', auth_middleware_1.authenticateJWT, gifts_controller_1.requireAdminJwt, gifts_controller_1.createEmojiGift);
router.post('/admin/upload-svga', auth_middleware_1.authenticateJWT, gifts_controller_1.requireAdminJwt, (req, res, next) => (0, gifts_controller_1.svgaUploadMiddleware)(req, res, (err) => {
    if (err)
        return res.status(400).json({ success: false, message: err.message });
    next();
}), gifts_controller_1.uploadSvgaGift);
router.patch('/admin/:id', auth_middleware_1.authenticateJWT, gifts_controller_1.requireAdminJwt, gifts_controller_1.updateGift);
router.delete('/admin/:id', auth_middleware_1.authenticateJWT, gifts_controller_1.requireAdminJwt, gifts_controller_1.deleteGift);
exports.default = router;
