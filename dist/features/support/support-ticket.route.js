"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../core/middlewares/auth.middleware");
const rbac_middleware_1 = require("../../core/middlewares/rbac.middleware");
const support_ticket_controller_1 = require("./support-ticket.controller");
const router = (0, express_1.Router)();
// ── User routes (mobile JWT) ──────────────────────────────────────────────────
router.get('/my-ticket', auth_middleware_1.authenticateJWT, support_ticket_controller_1.getOrCreateTicket);
router.post('/my-ticket/message', auth_middleware_1.authenticateJWT, support_ticket_controller_1.sendUserMessage);
// ── Admin routes ──────────────────────────────────────────────────────────────
router.get('/tickets', rbac_middleware_1.authenticateAdminPanel, support_ticket_controller_1.listTickets);
router.get('/tickets/:id', rbac_middleware_1.authenticateAdminPanel, support_ticket_controller_1.getTicket);
router.post('/tickets/:id/reply', rbac_middleware_1.authenticateAdminPanel, support_ticket_controller_1.adminReply);
router.patch('/tickets/:id/status', rbac_middleware_1.authenticateAdminPanel, support_ticket_controller_1.updateTicketStatus);
exports.default = router;
