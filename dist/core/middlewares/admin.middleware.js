"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateAdmin = void 0;
const authenticateAdmin = (req, res, next) => {
    const adminKey = req.headers['x-admin-key'];
    const expected = process.env.ADMIN_API_KEY || 'gobilive_admin_dev_key';
    if (!adminKey || adminKey !== expected) {
        res.status(403).json({ success: false, message: 'Admin access denied.' });
        return;
    }
    next();
};
exports.authenticateAdmin = authenticateAdmin;
