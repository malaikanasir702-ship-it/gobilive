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
const registration_controller_1 = require("./registration.controller");
const rbac_middleware_1 = require("../../core/middlewares/rbac.middleware");
const upload_middleware_1 = require("../upload/upload.middleware");
const auth_middleware_1 = require("../../core/middlewares/auth.middleware");
const registration_request_model_1 = require("../registration/registration-request.model");
const user_model_1 = require("../auth/user.model");
const router = (0, express_1.Router)();
// ── Public routes (no auth) ────────────────────────────────────────────────
router.post('/public/:role', upload_middleware_1.uploadMedia.array('documents', 5), registration_controller_1.submitPublicRegistration);
// ── App user route — check own registration status (requires app JWT) ──────
router.get('/my-status', auth_middleware_1.authenticateJWT, registration_controller_1.getMyRegistrationStatus);
// ── Admin-protected routes ─────────────────────────────────────────────────
router.use(rbac_middleware_1.authenticateAdminPanel);
const COMPANY_OR_SUPER = (0, rbac_middleware_1.requireRoles)('company_admin', 'super_admin');
router.get('/', COMPANY_OR_SUPER, registration_controller_1.listRegistrationRequests);
router.get('/:id', COMPANY_OR_SUPER, registration_controller_1.getRegistrationRequest);
router.post('/:id/approve', COMPANY_OR_SUPER, registration_controller_1.approveRegistration);
router.post('/:id/reject', COMPANY_OR_SUPER, registration_controller_1.rejectRegistration);
// ── Resend credentials email (for already-approved registrations) ────────
router.post('/:id/resend-email', COMPANY_OR_SUPER, async (req, res) => {
    try {
        const id = String(req.params.id);
        const request = await registration_request_model_1.RegistrationRequest.findById(id).lean();
        if (!request)
            return res.status(404).json({ success: false, message: 'Not found' });
        if (request.status !== 'approved') {
            return res.status(400).json({ success: false, message: 'Can only resend email for approved registrations' });
        }
        const emailTo = request.formData.email;
        if (!emailTo) {
            return res.status(400).json({ success: false, message: 'No email address on this registration' });
        }
        // Find the user account created for this registration
        const user = await user_model_1.User.findOne({
            $or: [
                { email: emailTo.toLowerCase() },
                ...(request.formData.phone ? [{ phone: request.formData.phone }] : []),
            ],
            role: request.role,
        }).select('username').lean();
        const username = user?.username ?? `(check admin panel)`;
        const tempPassword = 'Gobilive@123';
        const { sendApprovalEmail } = await Promise.resolve().then(() => __importStar(require('../../core/services/email.service')));
        await sendApprovalEmail({
            to: emailTo,
            fullName: request.formData.fullName || username,
            username,
            password: tempPassword,
            role: request.role,
        });
        res.json({ success: true, message: `Credentials email resent to ${emailTo}` });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
exports.default = router;
