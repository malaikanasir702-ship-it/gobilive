import { Response } from 'express';
import { Conversation, Message } from './chat.model';
import { User } from '../auth/user.model';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { sendToUser, NotificationTriggers } from '../notifications/notification.service';

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

    const { conversationId, text, mediaUrl, mediaType } = req.body;
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
      mediaType,
      status: 'sent',
    });

    conversation.lastMessage = text || (mediaType ? `[${mediaType}]` : '');
    conversation.lastMessageAt = new Date();
    await conversation.save();

    const userId = req.user!.id;
    const recipientId = conversation.participants
      .map(String)
      .find((id) => id !== userId);

    if (recipientId) {
      const recipient = await User.findById(recipientId);
      if (recipient?.notificationPrefs?.messages !== false) {
        sendToUser(
          recipientId,
          NotificationTriggers.newMessage(me?.username ?? 'Someone', text || 'New message')
        ).catch(() => {});
      }
    }

    res.status(201).json({ success: true, message });
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
