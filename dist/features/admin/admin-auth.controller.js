"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminChangePassword = exports.adminLogout = exports.adminLogin = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = require("../auth/user.model");
const ADMIN_ROLES = [
    'company_admin',
    'super_admin',
    'sub_admin',
    'agency',
    'sub_agency',
    'top_up_agent',
    'reseller',
];
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_gobilive_token_key_123!';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const adminLogin = async (req, res) => {
    try {
        const { email, phone, username, password } = req.body;
        if (!password || (!email && !phone && !username)) {
            res.status(400).json({ success: false, message: 'Email/phone/username and password are required.' });
            return;
        }
        let query;
        if (email)
            query = { email: email.toLowerCase().trim() };
        else if (phone)
            query = { phone: phone.trim() };
        else
            query = { username: username.trim() };
        const user = await user_model_1.User.findOne(query).select('username email role isBlocked blockedUntil blockType isTerminated isSuspended tokenVersion passwordHash profilePic beanWallet');
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
