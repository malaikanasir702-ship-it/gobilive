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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listRegistrationRequests = listRegistrationRequests;
exports.getRegistrationRequest = getRegistrationRequest;
exports.approveRegistration = approveRegistration;
exports.rejectRegistration = rejectRegistration;
exports.submitPublicRegistration = submitPublicRegistration;
exports.bulkApproveRegistrations = bulkApproveRegistrations;
exports.bulkRejectRegistrations = bulkRejectRegistrations;
exports.exportRegistrations = exportRegistrations;
exports.getMyRegistrationStatus = getMyRegistrationStatus;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const fs_1 = __importDefault(require("fs"));
const mongoose_1 = require("mongoose");
const cloudinary_1 = require("cloudinary");
const registration_request_model_1 = require("../registration/registration-request.model");
const user_model_1 = require("../auth/user.model");
const agency_model_1 = require("../agency/agency.model");
const activity_log_service_1 = require("../activity-log/activity-log.service");
const email_service_1 = require("../../core/services/email.service");
async function listRegistrationRequests(req, res) {
    try {
        const { role, status, page = 1, limit = 20 } = req.query;
        const filter = {};
        if (role)
            filter.role = role;
        if (status)
            filter.status = status;
        const total = await registration_request_model_1.RegistrationRequest.countDocuments(filter);
        const data = await registration_request_model_1.RegistrationRequest.find(filter)
            .sort({ createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit))
            .lean();
        res.json({ success: true, data, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function getRegistrationRequest(req, res) {
    try {
        const id = String(req.params.id);
        const doc = await registration_request_model_1.RegistrationRequest.findById(id).lean();
        if (!doc)
            return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data: doc });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function approveRegistration(req, res) {
    try {
        const id = String(req.params.id);
        const adminId = req.adminUser?.id || 'system';
        const adminRole = req.adminUser?.role || 'company_admin';
        const request = await registration_request_model_1.RegistrationRequest.findById(id);
        if (!request)
            return res.status(404).json({ success: false, message: 'Not found' });
        if (request.status !== 'pending')
            return res.status(400).json({ success: false, message: 'Already reviewed' });
        // Auto-generate a role-based ID code
        const genId = `${request.role.slice(0, 3).toUpperCase()}${Date.now().toString().slice(-6)}`;
        // Build a safe username from full name
        const baseUsername = (request.formData.fullName || genId)
            .replace(/\s+/g, '_')
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '');
        const username = `${baseUsername}_${Math.random().toString(36).slice(2, 5)}`;
        // Hash a temporary password
        const tempPassword = 'Gobilive@123';
        const passwordHash = await bcryptjs_1.default.hash(tempPassword, 10);
        // Map registration role to user role
        const userRole = request.role;
        // ── For HOST role with an existing app user (parentId) ─────────────────
        // The in-app host application stores the existing user's ID in formData.parentId.
        // Instead of creating a new account, promote the existing user to 'host'.
        if (request.role === 'host' && request.formData.parentId) {
            // Resolve agencyCode to the actual Agency ObjectId for consistent host lookup
            let resolvedAgencyRef = request.formData.agencyCode;
            if (request.formData.agencyCode) {
                const agencyDoc = await agency_model_1.Agency.findOne({ agencyCode: request.formData.agencyCode }).select('_id').lean();
                if (agencyDoc)
                    resolvedAgencyRef = agencyDoc._id;
            }
            const existingUser = await user_model_1.User.findByIdAndUpdate(request.formData.parentId, { role: 'host', agencyId: resolvedAgencyRef, $addToSet: { badges: 'host' } }, { new: true }).select('_id username');
            if (existingUser) {
                request.status = 'approved';
                request.reviewedBy = adminId;
                request.reviewedAt = new Date();
                request.generatedId = genId;
                await request.save();
                await (0, activity_log_service_1.logActivity)({
                    actorId: adminId, actorRole: adminRole,
                    actionType: 'approve_registration', targetEntityType: 'RegistrationRequest', targetEntityId: id,
                    description: `Approved host application for ${existingUser.username}. Role updated to host.`,
                    metadata: { userId: existingUser._id.toString() },
                });
                // Send approval email (fire-and-forget)
                const emailTo = request.formData.email;
                if (emailTo) {
                    (0, email_service_1.sendApprovalEmail)({
                        to: emailTo,
                        fullName: request.formData.fullName || existingUser.username,
                        username: existingUser.username,
                        password: '(your existing password)',
                        role: 'host',
                    }).catch(err => console.error('[Email] Failed to send approval email:', err.message));
                }
                return res.json({ success: true, data: { request, userId: existingUser._id, generatedId: genId } });
            }
        }
        // ── Determine parentId and agencyId based on role ──────────────────────
        // reseller     → parentId = the top-up agent's user ID (from formData.parentId)
        // host         → agencyId = the agency ID (from formData.agencyCode)
        // top_up_agent → parentId = company admin / super admin who created the link
        // agency       → ownerId handled below when creating Agency record
        // others       → no parent linkage needed
        const resolvedParentId = request.formData.parentId || undefined;
        // For host role: resolve agencyCode → Agency ObjectId for consistent lookup
        let resolvedAgencyId = undefined;
        if (request.role === 'host' && request.formData.agencyCode) {
            const agencyDoc = await agency_model_1.Agency.findOne({ agencyCode: request.formData.agencyCode }).select('_id').lean();
            resolvedAgencyId = agencyDoc ? agencyDoc._id : request.formData.agencyCode;
        }
        // ── Check if a user with this email AND role already exists ───────────
        // If so, update that account. Otherwise create a separate account for this role.
        let newUser;
        const existingEmailUser = request.formData.email
            ? await user_model_1.User.findOne({ email: request.formData.email.toLowerCase().trim(), role: userRole })
            : null;
        if (existingEmailUser) {
            // Update the existing user's fields for this role
            await user_model_1.User.findByIdAndUpdate(existingEmailUser._id, {
                passwordHash, // reset to temp password so they can login
                ...(resolvedParentId ? { parentId: resolvedParentId } : {}),
                ...(resolvedAgencyId ? { agencyId: resolvedAgencyId } : {}),
            });
            newUser = existingEmailUser;
        }
        else {
            newUser = await user_model_1.User.create({
                username,
                passwordHash,
                role: userRole,
                email: request.formData.email || undefined,
                phone: request.formData.phone || undefined,
                country: request.formData.country || undefined,
                region: request.formData.region || undefined,
                bankName: request.formData.bankName || undefined,
                bankAccountNumber: request.formData.bankAccountNumber || undefined,
                idCardNumber: request.formData.idCardNumber || undefined,
                cardNumber: request.formData.cardNumber || undefined,
                parentId: resolvedParentId,
                agencyId: resolvedAgencyId,
                idCardDocUrl: request.documentUrls?.[0] || undefined,
                faceVerificationUrl: request.documentUrls?.[1] || undefined,
            });
        }
        // If registering as agency, create Agency record.
        // Note: agencyCode is NOT required in the registration form for agency role —
        // we auto-generate one here so the condition never blocks creation.
        if (request.role === 'agency') {
            // Auto-generate a unique agency code if not provided (AGC + timestamp tail)
            const agencyCode = request.formData.agencyCode
                || `AGC${Date.now().toString().slice(-6)}`;
            const agencyDoc = {
                name: request.formData.fullName || username,
                ownerId: newUser._id.toString(),
                ownerUsername: username,
                agencyCode,
                status: 'active',
                isActive: true,
            };
            // Attach the approving admin's ID so the agency appears in their list.
            // super_admin  → superAdminId
            // company_admin / sub_admin → no ownership filter applied on their list
            if (adminRole === 'super_admin' && adminId !== 'system') {
                agencyDoc.superAdminId = new mongoose_1.Types.ObjectId(adminId);
            }
            await agency_model_1.Agency.create(agencyDoc);
        }
        request.status = 'approved';
        request.reviewedBy = adminId;
        request.reviewedAt = new Date();
        request.generatedId = genId;
        await request.save();
        await (0, activity_log_service_1.logActivity)({
            actorId: adminId, actorRole: adminRole,
            actionType: 'approve_registration', targetEntityType: 'RegistrationRequest', targetEntityId: id,
            description: `Approved ${request.role} registration for ${request.formData.fullName}. Generated ID: ${genId}`,
            metadata: { userId: newUser._id.toString() },
        });
        // Send approval email with credentials
        const emailTo = request.formData.email;
        if (emailTo) {
            try {
                await (0, email_service_1.sendApprovalEmail)({
                    to: emailTo,
                    fullName: request.formData.fullName || username,
                    username: existingEmailUser ? existingEmailUser.username : username,
                    password: tempPassword,
                    role: request.role,
                });
            }
            catch (emailErr) {
                console.error('[Email] Approval email failed:', emailErr.message);
                // Don't fail the whole approval if email fails — just log it
            }
        }
        res.json({ success: true, data: { request, userId: newUser._id, generatedId: genId } });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function rejectRegistration(req, res) {
    try {
        const id = String(req.params.id);
        const { reason } = req.body;
        const adminId = req.adminUser?.id || 'system';
        const adminRole = req.adminUser?.role || 'company_admin';
        const request = await registration_request_model_1.RegistrationRequest.findByIdAndUpdate(id, { status: 'rejected', rejectionReason: reason, reviewedBy: adminId, reviewedAt: new Date() }, { new: true });
        if (!request)
            return res.status(404).json({ success: false, message: 'Not found' });
        await (0, activity_log_service_1.logActivity)({
            actorId: adminId, actorRole: adminRole,
            actionType: 'reject_registration', targetEntityType: 'RegistrationRequest', targetEntityId: id,
            description: `Rejected ${request.role} registration for ${request.formData.fullName}. Reason: ${reason || 'N/A'}`,
        });
        // Send rejection email (fire-and-forget)
        const emailTo = request.formData.email;
        if (emailTo) {
            (0, email_service_1.sendRejectionEmail)({
                to: emailTo,
                fullName: request.formData.fullName || 'Applicant',
                role: request.role,
                reason: reason || undefined,
            }).catch(err => console.error('[Email] Failed to send rejection email:', err.message));
        }
        res.json({ success: true, data: request });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
// Public submission — no auth required
async function submitPublicRegistration(req, res) {
    try {
        const role = req.params.role;
        const validRoles = ['super_admin', 'sub_admin', 'agency', 'top_up_agent', 'reseller', 'host'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ success: false, message: 'Invalid registration role' });
        }
        const files = req.files;
        // Upload documents to Cloudinary (persistent) instead of local disk
        const documentUrls = [];
        if (files && files.length > 0) {
            for (const file of files) {
                try {
                    const result = await cloudinary_1.v2.uploader.upload(file.path, {
                        folder: 'gobilive_registrations',
                        resource_type: 'auto',
                        quality: 'auto:best',
                    });
                    documentUrls.push(result.secure_url);
                }
                catch (uploadErr) {
                    console.error('[Registration] Cloudinary upload error:', uploadErr.message);
                }
                finally {
                    // Clean up local temp file
                    if (fs_1.default.existsSync(file.path)) {
                        try {
                            fs_1.default.unlinkSync(file.path);
                        }
                        catch (_) { }
                    }
                }
            }
        }
        const { fullName, email, phone, idCardNumber, region, country, bankName, bankAccountNumber, cardNumber, agencyCode, parentId } = req.body;
        if (!fullName || (!email && !phone)) {
            return res.status(400).json({ success: false, message: 'fullName and email or phone are required' });
        }
        const request = await registration_request_model_1.RegistrationRequest.create({
            role,
            formData: { fullName, email, phone, idCardNumber, region, country, bankName, bankAccountNumber, cardNumber, agencyCode, parentId },
            documentUrls,
        });
        res.status(201).json({ success: true, message: 'Registration submitted. You will be notified upon approval.', requestId: request._id });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
exports.default = {};
// ── Bulk Approve Registrations ────────────────────────────────────────────────
// POST /registrations/bulk-approve  { ids: string[] }
async function bulkApproveRegistrations(req, res) {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: 'ids array is required.' });
        }
        if (ids.length > 50) {
            return res.status(400).json({ success: false, message: 'Max 50 registrations per bulk operation.' });
        }
        const results = [];
        for (const id of ids) {
            try {
                const request = await registration_request_model_1.RegistrationRequest.findById(id);
                if (!request || request.status !== 'pending') {
                    results.push({ id, status: 'skipped', reason: request ? `Already ${request.status}` : 'Not found' });
                    continue;
                }
                // Use same approval logic — mark approved, generate ID
                const genId = `${request.role.slice(0, 3).toUpperCase()}${Date.now().toString().slice(-6)}`;
                const baseUsername = (request.formData.fullName || genId).replace(/\s+/g, '_').toLowerCase().replace(/[^a-z0-9_]/g, '');
                const username = `${baseUsername}_${Math.random().toString(36).slice(2, 5)}`;
                const passwordHash = await bcryptjs_1.default.hash('Gobilive@123', 10);
                const newUser = await user_model_1.User.create({
                    username,
                    passwordHash,
                    role: request.role,
                    email: request.formData.email || undefined,
                    phone: request.formData.phone || undefined,
                    country: request.formData.country || undefined,
                    region: request.formData.region || undefined,
                    parentId: request.formData.parentId || undefined,
                });
                request.status = 'approved';
                request.reviewedBy = (req.adminUser?.id || 'system');
                request.reviewedAt = new Date();
                request.generatedId = genId;
                await request.save();
                // Send approval email (fire-and-forget)
                if (request.formData.email) {
                    (0, email_service_1.sendApprovalEmail)({
                        to: request.formData.email,
                        fullName: request.formData.fullName || username,
                        username,
                        password: 'Gobilive@123',
                        role: request.role,
                    }).catch(() => { });
                }
                results.push({ id, status: 'approved' });
                await (0, activity_log_service_1.logActivity)({
                    actorId: req.adminUser?.id || 'system',
                    actorRole: req.adminUser?.role || 'company_admin',
                    actionType: 'approve_registration',
                    targetEntityType: 'RegistrationRequest',
                    targetEntityId: id,
                    description: `[Bulk] Approved ${request.role} registration for ${request.formData.fullName}. User: ${newUser._id}`,
                });
            }
            catch (innerErr) {
                results.push({ id, status: 'skipped', reason: innerErr.message });
            }
        }
        const approved = results.filter(r => r.status === 'approved').length;
        const skipped = results.filter(r => r.status === 'skipped').length;
        res.json({ success: true, message: `Bulk approved ${approved} registration(s). ${skipped} skipped.`, results });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
// ── Bulk Reject Registrations ─────────────────────────────────────────────────
// POST /registrations/bulk-reject  { ids: string[], reason?: string }
async function bulkRejectRegistrations(req, res) {
    try {
        const { ids, reason } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: 'ids array is required.' });
        }
        if (ids.length > 50) {
            return res.status(400).json({ success: false, message: 'Max 50 registrations per bulk operation.' });
        }
        const results = [];
        const adminId = req.adminUser?.id || 'system';
        const adminRole = req.adminUser?.role || 'company_admin';
        for (const id of ids) {
            try {
                const request = await registration_request_model_1.RegistrationRequest.findById(id);
                if (!request || request.status !== 'pending') {
                    results.push({ id, status: 'skipped', reason: request ? `Already ${request.status}` : 'Not found' });
                    continue;
                }
                request.status = 'rejected';
                request.rejectionReason = reason || 'Bulk rejection';
                request.reviewedBy = adminId;
                request.reviewedAt = new Date();
                await request.save();
                if (request.formData.email) {
                    (0, email_service_1.sendRejectionEmail)({
                        to: request.formData.email,
                        fullName: request.formData.fullName || 'Applicant',
                        role: request.role,
                        reason: reason,
                    }).catch(() => { });
                }
                results.push({ id, status: 'rejected' });
                await (0, activity_log_service_1.logActivity)({
                    actorId: adminId,
                    actorRole: adminRole,
                    actionType: 'reject_registration',
                    targetEntityType: 'RegistrationRequest',
                    targetEntityId: id,
                    description: `[Bulk] Rejected ${request.role} registration for ${request.formData.fullName}. Reason: ${reason || 'N/A'}`,
                });
            }
            catch (innerErr) {
                results.push({ id, status: 'skipped', reason: innerErr.message });
            }
        }
        const rejected = results.filter(r => r.status === 'rejected').length;
        const skipped = results.filter(r => r.status === 'skipped').length;
        res.json({ success: true, message: `Bulk rejected ${rejected} registration(s). ${skipped} skipped.`, results });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
// ── Export Registrations as CSV ───────────────────────────────────────────────
async function exportRegistrations(req, res) {
    try {
        const { role, status } = req.query;
        const filter = {};
        if (role)
            filter.role = role;
        if (status)
            filter.status = status;
        const docs = await registration_request_model_1.RegistrationRequest.find(filter).sort({ createdAt: -1 }).limit(10000).lean();
        const rows = docs.map((d) => ({
            fullName: d.formData?.fullName ?? '',
            email: d.formData?.email ?? '',
            phone: d.formData?.phone ?? '',
            role: d.role,
            status: d.status,
            country: d.formData?.country ?? '',
            region: d.formData?.region ?? '',
            generatedId: d.generatedId ?? '',
            submittedAt: d.createdAt ? new Date(d.createdAt).toISOString() : '',
            reviewedAt: d.reviewedAt ? new Date(d.reviewedAt).toISOString() : '',
            rejectionReason: d.rejectionReason ?? '',
        }));
        const { sendCSV } = await Promise.resolve().then(() => __importStar(require('../../core/middlewares/csv-export.middleware')));
        sendCSV(res, rows, 'registrations');
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
/// GET /registrations/my-status?role=agency
/// Called from the mobile app (authenticated app user) to check whether
/// they have a pending/approved/rejected registration request.
/// Matches by the authenticated user's email or phone stored in their User record.
async function getMyRegistrationStatus(req, res) {
    try {
        const userId = req.user?.id || req.user?._id;
        const role = req.query.role || 'agency';
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        // Fetch the app user so we can match by email / phone
        const appUser = await user_model_1.User.findById(userId).select('email phone').lean();
        if (!appUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        // Build an OR query so either email or phone can match
        const orClauses = [];
        if (appUser.email)
            orClauses.push({ 'formData.email': appUser.email });
        if (appUser.phone)
            orClauses.push({ 'formData.phone': appUser.phone });
        if (orClauses.length === 0) {
            // No contact info to match on — return null gracefully
            return res.json({ success: true, data: null });
        }
        const doc = await registration_request_model_1.RegistrationRequest.findOne({
            role: role,
            $or: orClauses,
        })
            .sort({ createdAt: -1 })
            .lean();
        res.json({ success: true, data: doc ?? null });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
