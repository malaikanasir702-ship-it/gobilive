"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRoles = exports.authenticateAdminPanel = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = require("../../features/auth/user.model");
const ADMIN_ROLES = [
    'company_admin',
    'super_admin',
    'sub_admin',
    'agency',
    'sub_agency',
    'top_up_agent',
    'reseller',
];
/**
 * Authenticate any admin-panel portal user via JWT.
 * Populates req.adminUser with { id, username, role }.
 * Rejects if the role is 'user', 'host', or the account is blocked/terminated.
 */
const authenticateAdminPanel = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ success: false, message: 'Authorization token required.' });
        return;
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'super_secret_gobilive_token_key_123!');
        const dbUser = await user_model_1.User.findById(decoded.id).select('role isSuspended isBlocked blockedUntil isTerminated tokenVersion beanWallet');
        if (!dbUser) {
            res.status(401).json({ success: false, message: 'User not found.' });
            return;
        }
        // Block check with auto-expiry
        if (dbUser.isBlocked) {
            if (dbUser.blockedUntil && dbUser.blockedUntil < new Date()) {
                // Temp block expired — auto unblock
                await user_model_1.User.findByIdAndUpdate(dbUser._id, {
                    isBlocked: false,
                    $unset: { blockedUntil: 1, blockType: 1 },
                });
            }
            else {
                const until = dbUser.blockedUntil
                    ? `until ${dbUser.blockedUntil.toISOString()}`
                    : 'permanently';
                res.status(403).json({
                    success: false,
                    message: `Your account has been blocked ${until}.`,
                });
                return;
            }
        }
        if (dbUser.isTerminated) {
            res.status(403).json({
                success: false,
                message: 'Your account has been terminated.',
            });
            return;
        }
        if (dbUser.isSuspended) {
            res.status(403).json({
                success: false,
                message: 'Your account has been suspended.',
            });
            return;
        }
        if (typeof decoded.tokenVersion === 'number' &&
            decoded.tokenVersion !== dbUser.tokenVersion) {
            res.status(403).json({ success: false, message: 'Session revoked. Please log in again.' });
            return;
        }
        if (!ADMIN_ROLES.includes(dbUser.role)) {
            res.status(403).json({
                success: false,
                message: 'Access denied. This portal is for admin roles only.',
            });
            return;
        }
        req.adminUser = { id: decoded.id, username: decoded.username, role: dbUser.role };
        next();
    }
    catch {
        res.status(403).json({ success: false, message: 'Invalid or expired token.' });
    }
};
exports.authenticateAdminPanel = authenticateAdminPanel;
/**
 * Role-based access guard. Use after authenticateAdminPanel.
 * Usage: requireRoles('company_admin', 'super_admin')
 */
const requireRoles = (...roles) => (req, res, next) => {
    if (!req.adminUser) {
        res.status(401).json({ success: false, message: 'Not authenticated.' });
        return;
    }
    if (!roles.includes(req.adminUser.role)) {
        res.status(403).json({
            success: false,
            message: `Access denied. Required role(s): ${roles.join(', ')}.`,
        });
        return;
    }
    next();
};
exports.requireRoles = requireRoles;
