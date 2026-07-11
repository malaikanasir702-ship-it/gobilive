import { Request, Response } from 'express';
import { SupportTicket } from './support-ticket.model';
import { User } from '../auth/user.model';

interface AuthReq extends Request {
  user?: { id: string; username: string };
}

// ── User: get or create their ticket ─────────────────────────────────────────
export const getOrCreateTicket = async (req: AuthReq, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.id).select('username profilePic').lean();
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }

    let ticket = await SupportTicket.findOne({ userId: req.user!.id });
    if (!ticket) {
      ticket = await SupportTicket.create({
        userId: req.user!.id,
        userName: user.username,
        userProfilePic: user.profilePic || '',
      });
    }
    res.json({ success: true, ticket });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── User: send a message ──────────────────────────────────────────────────────
export const sendUserMessage = async (req: AuthReq, res: Response): Promise<void> => {
  try {
    const { text, attachmentUrl } = req.body;
    if (!text?.trim()) { res.status(400).json({ success: false, message: 'text is required' }); return; }
    const user = await User.findById(req.user!.id).select('username').lean();
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }

    const ticket = await SupportTicket.findOneAndUpdate(
      { userId: req.user!.id },
      {
        $push: { messages: { senderId: req.user!.id, senderRole: 'user', senderName: user.username, text: text.trim(), attachmentUrl, createdAt: new Date() } },
        $set: { lastMessageAt: new Date(), status: 'open' },
        $setOnInsert: { userName: user.username, userProfilePic: '' },
      },
      { new: true, upsert: true }
    );
    res.json({ success: true, ticket });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Admin: list all tickets ───────────────────────────────────────────────────
export const listTickets = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1'));
    const limit = Math.min(50, parseInt((req.query.limit as string) || '20'));
    const status = req.query.status as string | undefined;
    const filter: any = {};
    if (status && ['open', 'resolved', 'closed'].includes(status)) filter.status = status;
    const [tickets, total] = await Promise.all([
      SupportTicket.find(filter).sort({ lastMessageAt: -1 }).skip((page - 1) * limit).limit(limit).select('-messages').lean(),
      SupportTicket.countDocuments(filter),
    ]);
    res.json({ success: true, tickets, total, page, pages: Math.ceil(total / limit) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Admin: get single ticket ──────────────────────────────────────────────────
export const getTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const ticket = await SupportTicket.findById(req.params.id).lean();
    if (!ticket) { res.status(404).json({ success: false, message: 'Not found' }); return; }
    res.json({ success: true, ticket });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Admin: reply to ticket ────────────────────────────────────────────────────
export const adminReply = async (req: Request, res: Response): Promise<void> => {
  try {
    const { text, attachmentUrl } = req.body;
    const adminUser = (req as any).adminUser;
    if (!text?.trim()) { res.status(400).json({ success: false, message: 'text is required' }); return; }
    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      {
        $push: { messages: { senderId: adminUser.id, senderRole: adminUser.role, senderName: adminUser.username || 'Support', text: text.trim(), attachmentUrl, createdAt: new Date() } },
        $set: { lastMessageAt: new Date() },
      },
      { new: true }
    );
    if (!ticket) { res.status(404).json({ success: false, message: 'Not found' }); return; }
    res.json({ success: true, ticket });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Admin: update status ──────────────────────────────────────────────────────
export const updateTicketStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    if (!['open', 'resolved', 'closed'].includes(status)) { res.status(400).json({ success: false, message: 'Invalid status' }); return; }
    const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!ticket) { res.status(404).json({ success: false, message: 'Not found' }); return; }
    res.json({ success: true, ticket });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export default {};
