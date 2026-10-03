import { Response } from 'express';
import { Types } from 'mongoose';
import { Conversation, Message } from './chat.model';
import { User } from '../auth/user.model';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { sendToUser, NotificationTriggers } from '../notifications/notification.service';
import { getChatIO } from './chat.signaling';

export const getConversations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const conversations = await Conversation.find({
      participants: req.user.id,
    })
      .sort({ lastMessageAt: -1 })
      .populate('participants', 'username profilePic')
      .lean();

    // Attach unread count for each conversation:
    // count messages NOT sent by the current user that are not yet 'read'.
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await Message.countDocuments({
          conversationId: conv._id,
          senderId: { $ne: req.user!.id },
          status: { $ne: 'read' },
          isUnsent: false,
        });
        return { ...conv, unreadCount };
      })
    );

    res.status(200).json({ success: true, conversations: conversationsWithUnread });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const startConversation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const { userId } = req.body;
    const other = await User.findById(userId);
    if (!other) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [req.user.id, userId] },
    });

    if (!conversation) {
      const me = await User.findById(req.user.id);
      conversation = await Conversation.create({
        participants: [req.user.id, userId],
        participantUsernames: [me?.username ?? 'User', other.username],
      });
    }

    const populatedConversation = await Conversation.findById(conversation.id)
      .populate('participants', 'username profilePic')
      .lean();

    res.status(200).json({ success: true, conversation: populatedConversation || conversation });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation || !conversation.participants.map(String).includes(req.user.id)) {
      res.status(403).json({ success: false, message: 'Access denied.' });
      return;
    }

    const messages = await Message.find({
      conversationId: conversation.id,
      isUnsent: false,
    })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();

    res.status(200).json({ success: true, messages });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const sendMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const { conversationId, text, mediaUrl, mediaType, thumbnailUrl, postId } = req.body;
    const conversation = await Conversation.findById(conversationId);
    if (!conversation || !conversation.participants.map(String).includes(req.user.id)) {
      res.status(403).json({ success: false, message: 'Access denied.' });
      return;
    }

    const me = await User.findById(req.user.id);
    const message = await Message.create({
      conversationId,
      senderId: req.user.id,
      senderUsername: me?.username ?? 'User',
      text: text || '',
      mediaUrl,
      thumbnailUrl,
      postId: postId ? new Types.ObjectId(postId) : undefined,
      mediaType,
      status: 'sent',
    });

    const lastMsgText = text || (mediaType === 'video' || mediaType === 'post' ? 'Shared a video' : mediaType ? `[${mediaType}]` : '');
    conversation.lastMessage = lastMsgText;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    // Broadcast to conversation room and user rooms via socket
    const io = getChatIO();
    if (io) {
      const msgObj = message.toObject();
      io.to(`chat_${conversationId}`).emit('chat_message_received', msgObj);
      conversation.participants.forEach((pId: any) => {
        io.to(`user_${pId.toString()}`).emit('chat_message_received', msgObj);
        io.to(`chat_user_${pId.toString()}`).emit('chat_message_received', msgObj);
      });
    }

    const userId = req.user!.id;
    const recipientId = conversation.participants
      .map(String)
      .find((id) => id !== userId);

    if (recipientId) {
      const recipient = await User.findById(recipientId);
      if (recipient?.notificationPrefs?.messages !== false) {
        sendToUser(
          recipientId,
          NotificationTriggers.newMessage(me?.username ?? 'Someone', lastMsgText || 'New message')
        ).catch(() => {});
      }
    }

    res.status(201).json({ success: true, message });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createGroupConversation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const { name, memberIds } = req.body;
    const rawIds = Array.isArray(memberIds) ? memberIds : [];
    const participantIds = Array.from(new Set([req.user.id, ...rawIds])).map((id: string) => new Types.ObjectId(id));

    const users = await User.find({ _id: { $in: participantIds } }).select('username');
    const conversation = await Conversation.create({
      participants: participantIds,
      participantUsernames: users.map(u => u.username),
      isGroup: true,
      groupName: name || 'Group Chat',
      groupAdmin: new Types.ObjectId(req.user.id),
      lastMessage: 'Group created',
      lastMessageAt: new Date(),
    });

    res.status(201).json({ success: true, conversation });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const unsendMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const msg = await Message.findById(req.params.messageId);
    if (!msg || msg.senderId.toString() !== req.user.id) {
      res.status(403).json({ success: false, message: 'Cannot unsend this message.' });
      return;
    }

    msg.isUnsent = true;
    msg.text = '';
    await msg.save();

    res.status(200).json({ success: true, message: 'Message unsent.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markMessagesRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    await Message.updateMany(
      {
        conversationId: req.params.conversationId,
        senderId: { $ne: req.user.id },
        status: { $ne: 'read' },
      },
      { status: 'read' }
    );

    res.status(200).json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteConversation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation) {
      res.status(404).json({ success: false, message: 'Conversation not found.' });
      return;
    }

    // Only a participant can delete the conversation.
    if (!conversation.participants.map(String).includes(req.user.id)) {
      res.status(403).json({ success: false, message: 'Access denied.' });
      return;
    }

    // Delete all messages in the conversation, then the conversation itself.
    await Message.deleteMany({ conversationId: conversation._id });
    await conversation.deleteOne();

    res.status(200).json({ success: true, message: 'Conversation deleted.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
