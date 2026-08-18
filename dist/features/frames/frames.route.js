"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../core/middlewares/auth.middleware");
const rbac_middleware_1 = require("../../core/middlewares/rbac.middleware");
const frames_controller_1 = require("./frames.controller");
const router = (0, express_1.Router)();
// ── Public / User-authenticated ──────────────────────────────────────────────
// GET  /api/frames           — browse all active frames (store catalog)
router.get('/', frames_controller_1.getFrameCatalog);
// GET  /api/frames/my        — get user's purchased frames + active frame
router.get('/my', auth_middleware_1.authenticateJWT, frames_controller_1.getMyFrames);
// POST /api/frames/purchase/:id  — purchase a frame with Beans
router.post('/purchase/:id', auth_middleware_1.authenticateJWT, frames_controller_1.purchaseFrame);
// POST /api/frames/activate/:id  — set a purchased frame as active
router.post('/activate/:id', auth_middleware_1.authenticateJWT, frames_controller_1.activateFrame);
// ── Admin panel routes (company_admin JWT) ───────────────────────────────────
// GET  /api/frames/admin/all       — all frames including inactive
router.get('/admin/all', rbac_middleware_1.authenticateAdminPanel, frames_controller_1.getAllFramesAdmin);
// POST /api/frames/admin/upload    — upload new frame PNG
router.post('/admin/upload', rbac_middleware_1.authenticateAdminPanel, (req, res, next) => (0, frames_controller_1.frameUploadMiddleware)(req, res, (err) => {
    if (err)
        return res.status(400).json({ success: false, message: err.message });
    next();
}), frames_controller_1.uploadFrame);
// PATCH /api/frames/admin/:id      — update name/price/scale/isActive/sortOrder
router.patch('/admin/:id', rbac_middleware_1.authenticateAdminPanel, frames_controller_1.updateFrame);
// DELETE /api/frames/admin/:id     — delete frame permanently
router.delete('/admin/:id', rbac_middleware_1.authenticateAdminPanel, frames_controller_1.deleteFrame);
exports.default = router;
