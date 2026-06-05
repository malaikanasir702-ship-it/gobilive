import { Request, Response } from 'express';
import { SupportChat } from '../support/support-chat.model';
import { logActivity } from '../activity-log/activity-log.service';

export async function listSupportChats(req: Request, res: Response) {
  try {
    const { agencyId, participantId, page = 1, limit = 20 } = req.query as any;
    const adminUser = (req as any).adminUser;
    const filter: any = {};

    // Agency sees only their own chats; admins see all
    if (adminUser?.role === 'agency' || adminUser?.role === 'sub_agency') {
      filter.agencyId = adminUser.id;
    } else {
      if (agencyId) filter.agencyId = agencyId;
    }
    if (participantId) filter.participantId = participantId;

    const total = await SupportChat.countDocuments(filter);
    const data = await SupportChat.find(filter)
      .sort({ lastMessageAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .select('-messages') // exclude messages for list view (load on detail)
      .lean();

    res.json({ success: true, data, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getSupportChat(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const adminUser = (req as any).adminUser;
    const chat = await SupportChat.findById(id).lean();
    if (!chat) return res.status(404).json({ success: false, message: 'Not found' });

    // Agency can only view their own chats
    if ((adminUser?.role === 'agency' || adminUser?.role === 'sub_agency') &&
        chat.agencyId.toString() !== adminUser.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, data: chat });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function replyToSupportChat(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { message, attachmentUrl } = req.body;
    const adminUser = (req as any).adminUser;

    if (!message) return res.status(400).json({ success: false, message: 'message is required' });

    const chat = await SupportChat.findById(id);
    if (!chat) return res.status(404).json({ success: false, message: 'Not found' });

    // Only agency (owner) can reply; admins have view-only access
    if (adminUser?.role !== 'agency' && adminUser?.role !== 'sub_agency') {
      return res.status(403).json({ success: false, message: 'Only agency admins can reply to support chats' });
    }

    chat.messages.push({
      senderId: adminUser.id as any,
      senderRole: adminUser.role,
      message,
      attachmentUrl,
      createdAt: new Date(),
    } as any);
    chat.lastMessageAt = new Date();
    await chat.save();

    await logActivity({
      actorId: adminUser.id, actorRole: adminUser.role,
      actionType: 'support_reply', targetEntityType: 'SupportChat', targetEntityId: id,
      description: `Agency replied to support chat: "${message.slice(0, 80)}"`,
    });

    res.json({ success: true, data: chat });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function closeSupportChat(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const adminUser = (req as any).adminUser;
    const chat = await SupportChat.findByIdAndUpdate(
      id,
      { $set: { closedAt: new Date() } } as any,
      { new: true }
    );
    if (!chat) return res.status(404).json({ success: false, message: 'Not found' });

    await logActivity({
      actorId: adminUser?.id, actorRole: adminUser?.role || 'agency',
      actionType: 'close_support', targetEntityType: 'SupportChat', targetEntityId: id,
      description: 'Closed support chat',
    });

    res.json({ success: true, data: chat });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export default {};
