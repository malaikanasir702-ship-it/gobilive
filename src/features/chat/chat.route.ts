import { Router } from 'express';
import { authenticateJWT } from '../../core/middlewares/auth.middleware';
import {
  getConversations,
  startConversation,
  getMessages,
  sendMessage,
  unsendMessage,
  markMessagesRead,
  deleteConversation,
} from './chat.controller';

const router = Router();

router.get('/conversations', authenticateJWT as any, getConversations as any);
router.post('/conversations', authenticateJWT as any, startConversation as any);
router.delete('/conversations/:conversationId', authenticateJWT as any, deleteConversation as any);
router.get('/conversations/:conversationId/messages', authenticateJWT as any, getMessages as any);
router.post('/messages', authenticateJWT as any, sendMessage as any);
router.post('/messages/:messageId/unsend', authenticateJWT as any, unsendMessage as any);
router.post('/conversations/:conversationId/read', authenticateJWT as any, markMessagesRead as any);

export default router;
