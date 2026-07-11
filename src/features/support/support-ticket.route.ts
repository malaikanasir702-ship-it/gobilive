import { Router } from 'express';
import { authenticateJWT } from '../../core/middlewares/auth.middleware';
import { authenticateAdminPanel } from '../../core/middlewares/rbac.middleware';
import {
  getOrCreateTicket,
  sendUserMessage,
  listTickets,
  getTicket,
  adminReply,
  updateTicketStatus,
} from './support-ticket.controller';

const router = Router();

// ── User routes (mobile JWT) ──────────────────────────────────────────────────
router.get('/my-ticket', authenticateJWT as any, getOrCreateTicket as any);
router.post('/my-ticket/message', authenticateJWT as any, sendUserMessage as any);

// ── Admin routes ──────────────────────────────────────────────────────────────
router.get('/tickets', authenticateAdminPanel as any, listTickets as any);
router.get('/tickets/:id', authenticateAdminPanel as any, getTicket as any);
router.post('/tickets/:id/reply', authenticateAdminPanel as any, adminReply as any);
router.patch('/tickets/:id/status', authenticateAdminPanel as any, updateTicketStatus as any);

export default router;
