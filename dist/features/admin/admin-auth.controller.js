"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminVerifyOtpReset = exports.adminForgotPassword = exports.adminChangePassword = exports.adminLogout = exports.adminLogin = exports.checkRoles = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = require("../auth/user.model");
const email_service_1 = require("../../core/services/email.service");
const ADMIN_ROLES = [
    'company_admin',
    'super_admin',
    'sub_admin',
    'agency',
    'sub_agency',
    'top_up_agent',
    'reseller',
];
// Prevents timing-based user enumeration when no candidates exist
const DUMMY_HASH = '$2b$12$invalidhashvaluethatnevermatchesXXXXXXXXXXXXXXXXXXXXXXX';
const ROLE_LABELS = {
    company_admin: 'Company Admin',
    super_admin: 'Super Admin',
    sub_admin: 'Sub Admin',
    agency: 'Agency',
    sub_agency: 'Sub Agency',
    top_up_agent: 'Top-Up Agent',
    reseller: 'Reseller',
};
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_gobilive_token_key_123!';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const checkRoles = async (req, res) => {
    try {
        const { identity, password } = req.body;
        // 1. Validate input
        if (!identity?.trim() || !password?.trim()) {
            res.status(400).json({ success: false, message: 'Identity and password are required.' });
            return;
        }
        // 2. Query candidates
        const candidates = await user_model_1.User.find({
            $or: [
                { email: identity.toLowerCase().trim() },
                { phone: identity.trim() },
                { username: identity.trim() },
            ],
            role: { $in: ADMIN_ROLES },
        }).select('username email role passwordHash isBlocked blockedUntil blockType isTerminated isSuspended tokenVersion profilePic beanWallet');
        // 3. Timing-safe guard — prevent user enumeration
        if (candidates.length === 0) {
            await bcryptjs_1.default.compare(password, DUMMY_HASH);
            res.status(401).json({ success: false, message: 'Invalid credentials.' });
            return;
        }
        // 4. Password matching
        const matched = [];
        for (const candidate of candidates) {
            const ok = await bcryptjs_1.default.compare(password, candidate.passwordHash);
            if (ok)
                matched.push(candidate);
        }
        if (matched.length === 0) {
            res.status(401).json({ success: false, message: 'Invalid credentials.' });
            return;
        }
        // 5. Status filtering
        const accessible = [];
        for (const user of matched) {
            if (user.isTerminated || user.isSuspended)
                continue;
            if (user.isBlocked) {
                if (user.blockedUntil && user.blockedUntil < new Date()) {
                    // Auto-clear expired block
                    await user_model_1.User.findByIdAndUpdate(user._id, {
                        isBlocked: false,
                        $unset: { blockedUntil: 1, blockType: 1 },
                    });
                    accessible.push(user);
                }
                else {
                    continue; // Still blocked
                }
            }
            else {
                accessible.push(user);
            }
        }
        if (accessible.length === 0) {
            res.status(403).json({ success: false, message: 'No accessible admin accounts found for these credentials.' });
            return;
        }
        // 6. Single role shortcut
        if (accessible.length === 1) {
            const user = accessible[0];
            const token = jsonwebtoken_1.default.sign({ id: user._id.toString(), username: user.username, role: user.role, tokenVersion: user.tokenVersion }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
            res.status(200).json({
                success: true,
                multipleRoles: false,
                token,
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    profilePic: user.profilePic,
                    beanWallet: user.beanWallet,
                },
            });
            return;
        }
        // 7. Multiple roles
        const roles = accessible.map((u) => ({
            roleId: u.role,
            label: ROLE_LABELS[u.role],
            userId: u._id.toString(),
        }));
        res.status(200).json({ success: true, multipleRoles: true, roles });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.checkRoles = checkRoles;
const adminLogin = async (req, res) => {
    try {
        const identity = req.body.identity?.trim();
        const { email, phone, username, password, selectedRole } = req.body;
        if (!password || (!identity && !email && !phone && !username)) {
            res.status(400).json({ success: false, message: 'Identity and password are required.' });
            return;
        }
        let identityQuery;
        if (identity) {
            identityQuery = {
                $or: [
                    { email: identity.toLowerCase() },
                    { phone: identity },
                    { username: identity },
                ],
            };
        }
        else if (email) {
            identityQuery = { email: email.toLowerCase().trim() };
        }
        else if (phone) {
            identityQuery = { phone: phone.trim() };
        }
        else {
            identityQuery = { username: username.trim() };
        }
        if (selectedRole) {
            if (!ADMIN_ROLES.includes(selectedRole)) {
                res.status(403).json({ success: false, message: 'Access denied. This portal is for admin roles only.' });
                return;
            }
            identityQuery = { ...identityQuery, role: selectedRole };
        }
        const user = await user_model_1.User.findOne(identityQuery).select('username email role isBlocked blockedUntil blockType isTerminated isSuspended tokenVersion passwordHash profilePic beanWallet');
        if (!user) {
            res.status(401).json({ success: false, message: 'Invalid credentials.' });
            return;
        }
        const isMatch = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isMatch) {
            res.status(401).json({ success: false, message: 'Invalid credentials.' });
            return;
        }
        if (!ADMIN_ROLES.includes(user.role)) {
            res.status(403).json({
                success: false,
                message: 'Access denied. This portal is for admin roles only.',
            });
            return;
        }
        // Block checks
        if (user.isTerminated) {
            res.status(403).json({ success: false, message: 'Your account has been terminated.' });
            return;
        }
        if (user.isSuspended) {
            res.status(403).json({ success: false, message: 'Your account has been suspended.' });
            return;
        }
        if (user.isBlocked) {
            if (user.blockedUntil && user.blockedUntil < new Date()) {
                // Auto-expire temporary block
                await user_model_1.User.findByIdAndUpdate(user._id, {
                    isBlocked: false,
                    $unset: { blockedUntil: 1, blockType: 1 },
                });
            }
            else {
                const until = user.blockedUntil
                    ? `until ${user.blockedUntil.toISOString()}`
                    : 'permanently';
                res.status(403).json({
                    success: false,
                    message: `Your account has been blocked ${until}.`,
                });
                return;
            }
        }
        const token = jsonwebtoken_1.default.sign({ id: user._id.toString(), username: user.username, role: user.role, tokenVersion: user.tokenVersion }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        res.status(200).json({
            success: true,
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                profilePic: user.profilePic,
                beanWallet: user.beanWallet,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.adminLogin = adminLogin;
const adminLogout = async (req, res) => {
    // Increment tokenVersion to invalidate all existing JWTs for this user
    try {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            await user_model_1.User.findByIdAndUpdate(decoded.id, { $inc: { tokenVersion: 1 } });
        }
        res.status(200).json({ success: true, message: 'Logged out successfully.' });
    }
    catch {
        res.status(200).json({ success: true, message: 'Logged out.' });
    }
};
exports.adminLogout = adminLogout;
const adminChangePassword = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            res.status(401).json({ success: false, message: 'Authorization token required.' });
            return;
        }
        const token = authHeader.split(' ')[1];
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            res.status(400).json({ success: false, message: 'currentPassword and newPassword are required.' });
            return;
        }
        if (newPassword.length < 6) {
            res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
            return;
        }
        const user = await user_model_1.User.findById(decoded.id).select('passwordHash tokenVersion');
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        const isMatch = await bcryptjs_1.default.compare(currentPassword, user.passwordHash);
        if (!isMatch) {
            res.status(400).json({ success: false, message: 'Current password is incorrect.' });
            return;
        }
        const hashed = await bcryptjs_1.default.hash(newPassword, 12);
        // Also increment tokenVersion to invalidate all old sessions
        await user_model_1.User.findByIdAndUpdate(decoded.id, {
            passwordHash: hashed,
            $inc: { tokenVersion: 1 },
        });
        res.status(200).json({ success: true, message: 'Password changed successfully. Please log in again.' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.adminChangePassword = adminChangePassword;
// ─── POST /api/admin-panel/v1/auth/forgot-password ───────────────────────────
// Sends a 6-digit OTP to the admin's registered email address.
const adminForgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email?.trim()) {
            res.status(400).json({ success: false, message: 'Email is required.' });
            return;
        }
        const user = await user_model_1.User.findOne({
            email: email.toLowerCase().trim(),
            role: { $in: ADMIN_ROLES },
        }).select('email username role resetPasswordToken resetPasswordExpires');
        // Always respond success to prevent email enumeration
        if (!user) {
            res.status(200).json({
                success: true,
                message: 'If this email is registered, a reset code has been sent.',
            });
            return;
        }
        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.resetPasswordToken = otp;
        user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 min
        await user.save({ validateModifiedOnly: true });
        try {
            await (0, email_service_1.sendPasswordResetEmail)({ to: user.email, resetCode: otp });
        }
        catch (emailErr) {
            console.error('[adminForgotPassword] Email send failed:', emailErr);
            // Still return success — OTP is stored; admin can try again
        }
        res.status(200).json({
            success: true,
            message: 'If this email is registered, a reset code has been sent.',
        });
    }
    catch (err) {
        console.error('[adminForgotPassword]', err);
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.adminForgotPassword = adminForgotPassword;
// ─── POST /api/admin-panel/v1/auth/reset-password ────────────────────────────
// Verifies OTP and sets a new password for the admin account.
const adminVerifyOtpReset = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        if (!email?.trim() || !otp?.trim() || !newPassword) {
            res.status(400).json({ success: false, message: 'email, otp, and newPassword are required.' });
            return;
        }
        if (newPassword.length < 6) {
            res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
            return;
        }
        const user = await user_model_1.User.findOne({
            email: email.toLowerCase().trim(),
            role: { $in: ADMIN_ROLES },
        }).select('passwordHash resetPasswordToken resetPasswordExpires tokenVersion');
        if (!user) {
            res.status(400).json({ success: false, message: 'Invalid request.' });
            return;
        }
        if (!user.resetPasswordToken || user.resetPasswordToken !== String(otp).trim()) {
            res.status(400).json({ success: false, message: 'Invalid OTP. Please check and try again.' });
            return;
        }
        if (user.resetPasswordExpires && user.resetPasswordExpires < new Date()) {
            res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
            return;
        }
        // Set new password
        user.passwordHash = await bcryptjs_1.default.hash(newPassword, 12);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        user.tokenVersion = (user.tokenVersion || 0) + 1; // Invalidate all existing sessions
        await user.save();
        res.status(200).json({ success: true, message: 'Password reset successfully. Please log in with your new password.' });
    }
    catch (err) {
        console.error('[adminVerifyOtpReset]', err);
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.adminVerifyOtpReset = adminVerifyOtpReset;
