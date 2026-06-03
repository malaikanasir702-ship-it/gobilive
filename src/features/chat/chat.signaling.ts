import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Message, Conversation } from './chat.model';

interface ChatJoinPayload {
  conversationId: string;
}

interface ChatMessagePayload {
  conversationId: string;
  text: string;
  senderId: string;
  senderUsername: string;
}

function verifySocketToken(socket: Socket): { id: string; username: string } | null {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) return null;
  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'super_secret_gobilive_token_key_123!'
    ) as { id: string; username: string };
    return decoded;
  } catch {
    return null;
  }
}

export function registerChatSignaling(io: Server) {
  io.on('connection', (socket) => {
    const user = verifySocketToken(socket);
    if (!user) return;

    socket.on('join_conversation', async (data: ChatJoinPayload) => {
      const conv = await Conversation.findById(data.conversationId);
      if (!conv || !conv.participants.map(String).includes(user.id)) return;
      socket.join(`chat_${data.conversationId}`);
    });

    socket.on('leave_conversation', (data: ChatJoinPayload) => {
      socket.leave(`chat_${data.conversationId}`);
    });

    socket.on('chat_message', async (data: ChatMessagePayload) => {
      const conv = await Conversation.findById(data.conversationId);
      if (!conv || data.senderId !== user.id) return;

      const message = await Message.create({
        conversationId: data.conversationId,
        senderId: user.id,
        senderUsername: data.senderUsername,
        text: data.text,
        status: 'sent',
      });

      conv.lastMessage = data.text;
      conv.lastMessageAt = new Date();
      await conv.save();

      io.to(`chat_${data.conversationId}`).emit('chat_message_received', {
        ...message.toObject(),
        conversationId: data.conversationId,
      });
    });

    socket.on('chat_typing', (data: { conversationId: string; username: string }) => {
      socket.to(`chat_${data.conversationId}`).emit('chat_typing', data);
    });

    socket.on('chat_read', async (data: { conversationId: string }) => {
      await Message.updateMany(
        {
          conversationId: data.conversationId,
          senderId: { $ne: user.id },
          status: { $ne: 'read' },
        },
        { status: 'read' }
      );
      io.to(`chat_${data.conversationId}`).emit('chat_messages_read', {
        conversationId: data.conversationId,
        readerId: user.id,
      });
    });
  });

  console.log('💬 Chat signaling registered');
}
