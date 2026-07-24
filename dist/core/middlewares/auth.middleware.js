"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateJWT = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = require("../../features/auth/user.model");
const authenticateJWT = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ success: false, message: 'Authorization token required' });
        return;
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'super_secret_gobilive_token_key_123!');
        // Check token version (for "sign out of all other sessions")
        const dbUser = await user_model_1.User.findById(decoded.id).select('isSuspended tokenVersion');
        if (dbUser && dbUser.isSuspended) {
            res.status(403).json({
                success: false,
                message: 'Your account has been suspended by the administrator.',
            });
            return;
        }
        if (dbUser && typeof decoded.tokenVersion === 'number' && decoded.tokenVersion !== dbUser.tokenVersion) {
            res.status(403).json({
                success: false,
                message: 'Session revoked. Please log in again.',
            });
            return;
        }
        req.user = decoded;
        next();
    }
    catch (error) {
        res.status(403).json({ success: false, message: 'Invalid or expired authorization token' });
    }
};
exports.authenticateJWT = authenticateJWT;
