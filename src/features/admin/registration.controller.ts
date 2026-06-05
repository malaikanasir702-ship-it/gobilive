import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { RegistrationRequest } from '../registration/registration-request.model';
import { User } from '../auth/user.model';
import { Agency } from '../agency/agency.model';
import { logActivity } from '../activity-log/activity-log.service';

export async function listRegistrationRequests(req: Request, res: Response) {
  try {
    const { role, status, page = 1, limit = 20 } = req.query as any;
    const filter: any = {};
    if (role) filter.role = role;
    if (status) filter.status = status;

    const total = await RegistrationRequest.countDocuments(filter);
    const data = await RegistrationRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    res.json({ success: true, data, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getRegistrationRequest(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const doc = await RegistrationRequest.findById(id).lean();
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: doc });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function approveRegistration(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const adminId = (req as any).adminUser?.id || 'system';
    const adminRole = (req as any).adminUser?.role || 'company_admin';

    const request = await RegistrationRequest.findById(id);
    if (!request) return res.status(404).json({ success: false, message: 'Not found' });
    if (request.status !== 'pending') return res.status(400).json({ success: false, message: 'Already reviewed' });

    // Auto-generate a role-based ID code
    const genId = `${request.role.slice(0, 3).toUpperCase()}${Date.now().toString().slice(-6)}`;

    // Build a safe username from full name
    const baseUsername = (request.formData.fullName || genId)
      .replace(/\s+/g, '_')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '');
    const username = `${baseUsername}_${Math.random().toString(36).slice(2, 5)}`;

    // Hash a temporary password
    const passwordHash = await bcrypt.hash('Gobilive@123', 10);

    // Map registration role to user role
    const userRole = request.role === 'host' ? 'user' : request.role as any;

    const newUser = await User.create({
      username,
      passwordHash,
      role: userRole,
      email: request.formData.email,
      phone: request.formData.phone,
      country: request.formData.country,
      region: request.formData.region,
      bankName: request.formData.bankName,
      bankAccountNumber: request.formData.bankAccountNumber,
      idCardNumber: request.formData.idCardNumber,
      cardNumber: request.formData.cardNumber,
      parentId: request.formData.parentId,
      agencyId: request.formData.agencyCode,
      idCardDocUrl: request.documentUrls?.[0],
      faceVerificationUrl: request.documentUrls?.[1],
    } as any);

    // If registering as agency, create Agency record
    if (request.role === 'agency' && request.formData.agencyCode) {
      await Agency.create({
        name: request.formData.fullName || username,
        ownerId: newUser._id.toString(),
        ownerUsername: username,
        agencyCode: request.formData.agencyCode,
      });
    }

    request.status = 'approved';
    request.reviewedBy = adminId as any;
    request.reviewedAt = new Date();
    request.generatedId = genId;
    await request.save();

    await logActivity({
      actorId: adminId, actorRole: adminRole,
      actionType: 'approve_registration', targetEntityType: 'RegistrationRequest', targetEntityId: id,
      description: `Approved ${request.role} registration for ${request.formData.fullName}. Generated ID: ${genId}`,
      metadata: { userId: newUser._id.toString() },
    });

    res.json({ success: true, data: { request, userId: newUser._id, generatedId: genId } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function rejectRegistration(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = (req as any).adminUser?.id || 'system';
    const adminRole = (req as any).adminUser?.role || 'company_admin';

    const request = await RegistrationRequest.findByIdAndUpdate(
      id,
      { status: 'rejected', rejectionReason: reason, reviewedBy: adminId, reviewedAt: new Date() },
      { new: true }
    );
    if (!request) return res.status(404).json({ success: false, message: 'Not found' });

    await logActivity({
      actorId: adminId, actorRole: adminRole,
      actionType: 'reject_registration', targetEntityType: 'RegistrationRequest', targetEntityId: id,
      description: `Rejected ${request.role} registration for ${request.formData.fullName}. Reason: ${reason || 'N/A'}`,
    });

    res.json({ success: true, data: request });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// Public submission — no auth required
export async function submitPublicRegistration(req: Request, res: Response) {
  try {
    const role = req.params.role as any;
    const validRoles = ['super_admin', 'sub_admin', 'agency', 'top_up_agent', 'reseller', 'host'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid registration role' });
    }

    const files = (req as any).files as Express.Multer.File[] | undefined;
    const documentUrls = files
      ? files.map(f => `${req.protocol}://${req.get('host')}/uploads/${f.filename}`)
      : [];

    const { fullName, email, phone, idCardNumber, region, country,
            bankName, bankAccountNumber, cardNumber, agencyCode, parentId } = req.body;

    if (!fullName || (!email && !phone)) {
      return res.status(400).json({ success: false, message: 'fullName and email or phone are required' });
    }

    const request = await RegistrationRequest.create({
      role,
      formData: { fullName, email, phone, idCardNumber, region, country, bankName, bankAccountNumber, cardNumber, agencyCode, parentId },
      documentUrls,
    });

    res.status(201).json({ success: true, message: 'Registration submitted. You will be notified upon approval.', requestId: request._id });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export default {};
