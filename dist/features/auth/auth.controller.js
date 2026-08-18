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
exports.resetPassword = exports.verifyOtpAndResetPassword = exports.sendAccountRecoveryOtp = exports.findMyAccount = exports.forgotPassword = exports.getMyHostApplication = exports.applyAsHost = exports.getMedals = exports.claimDailyReward = exports.adminLogout = exports.adminLogin = exports.unlinkGoogleAccount = exports.linkGoogleAccount = exports.disableTwoFactor = exports.verifyTwoFactor = exports.setupTwoFactor = exports.changePassword = exports.logoutAllSessions = exports.getProfile = exports.googleLogin = exports.login = exports.register = exports.getSafeUser = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const speakeasy_1 = __importDefault(require("speakeasy"));
const user_model_1 = require("./user.model");
const google_auth_service_1 = require("./google-auth.service");
const registration_request_model_1 = require("../registration/registration-request.model");
const agency_model_1 = require("../agency/agency.model");
const email_service_1 = require("../../core/services/email.service");
// Helpers to generate tokens
const generateToken = (userId, username, tokenVersion = 0) => {
    return jsonwebtoken_1.default.sign({ id: userId, username, tokenVersion }, process.env.JWT_SECRET || 'super_secret_gobilive_token_key_123!', { expiresIn: '30d' } // Extended expiration for mobile devices
    );
};
const getSafeUser = async (userId) => {
    const user = await user_model_1.User.findById(userId).select('-passwordHash').lean({ virtuals: true });
    if (!user)
        return null;
    const rolesSet = new Set();
    // Primary role
    if (user.role && user.role !== 'user') {
        rolesSet.add(user.role);
    }
    // Check if user owns an agency
    const isAgencyOwner = await agency_model_1.Agency.exists({ ownerId: user._id.toString() });
    if (isAgencyOwner) {
        rolesSet.add('agency');
    }
    // Check host status
    if (user.role === 'host' || user.agencyId) {
        rolesSet.add('host');
    }
    // Combine existing badges and roles array
    if (Array.isArray(user.badges)) {
        user.badges.forEach((b) => {
            if (b && b !== 'user')
                rolesSet.add(b.toLowerCase());
        });
    }
    if (Array.isArray(user.roles)) {
        user.roles.forEach((r) => {
            if (r && r !== 'user')
                rolesSet.add(r.toLowerCase());
        });
    }
    user.roles = Array.from(rolesSet);
    // Sync badges to include all active roles as well
    const badgeSet = new Set((user.badges || []).map((b) => b.toString().toLowerCase()));
    rolesSet.forEach((r) => badgeSet.add(r));
    user.badges = Array.from(badgeSet);
    // Populate active frame data so Flutter app has imageUrl + avatarScale inline
    if (user.activeFrameId) {
        try {
            const { Frame } = await Promise.resolve().then(() => __importStar(require('../frames/frame.model')));
            const frame = await Frame.findById(user.activeFrameId)
                .select('name imageUrl avatarScale')
                .lean();
            if (frame) {
                user.activeFrameUrl = frame.imageUrl;
                user.activeFrameScale = frame.avatarScale ?? 0.60;
                user.activeFrame = {
                    id: frame._id?.toString(),
                    name: frame.name,
                    imageUrl: frame.imageUrl,
                    avatarScale: frame.avatarScale ?? 0.60,
                };
            }
        }
        catch (_) {
            // Frame not found or error — continue without frame data
        }
    }
    return user;
};
exports.getSafeUser = getSafeUser;
const register = async (req, res) => {
    try {
        const { username, email, phone, password } = req.body;
        if (!username || !password || (!email && !phone)) {
            res.status(400).json({ success: false, message: 'Username, password, and either email or phone are required.' });
            return;
        }
        // Check duplicate username / email / phone in a single query.
        const existingUser = await user_model_1.User.findOne({
            $or: [
                { username },
                ...(email ? [{ email }] : []),
                ...(phone ? [{ phone }] : []),
            ],
        }).lean();
        if (existingUser) {
            if (existingUser.username === username) {
                res.status(400).json({ success: false, message: 'Username is already taken.' });
                return;
            }
            if (email != null && existingUser.email === email) {
                res.status(400).json({ success: false, message: 'Email is already registered.' });
                return;
            }
            if (phone != null && existingUser.phone === phone) {
                res.status(400).json({ success: false, message: 'Phone number is already registered.' });
                return;
            }
            res.status(400).json({ success: false, message: 'Account already exists with the provided identity.' });
            return;
        }
        // Hashing password
        const salt = await bcryptjs_1.default.genSalt(10);
        const passwordHash = await bcryptjs_1.default.hash(password, salt);
        // Create user
        const newUser = new user_model_1.User({
            username,
            email,
            phone,
            passwordHash
        });
        await newUser.save();
        // Sign Token
        const token = generateToken(newUser.id, newUser.username, newUser.tokenVersion ?? 0);
        const safeUser = await (0, exports.getSafeUser)(newUser.id);
        res.status(201).json({
            success: true,
            message: 'Account created successfully.',
            token,
            user: safeUser,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message || 'Error occurred during registration.' });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { identity, password } = req.body; // identity can be email, phone or username
        if (!identity || !password) {
            res.status(400).json({ success: false, message: 'Identity and password fields are required.' });
            return;
        }
        // Locate user by username, email or phone as a plain object for a lighter login path.
        const user = await user_model_1.User.findOne({
            $or: [
                { username: identity },
                { email: identity },
                { phone: identity }
            ]
        }).lean({ virtuals: true });
        if (!user || !user.passwordHash) {
            res.status(401).json({ success: false, message: 'Invalid credentials.' });
            return;
        }
        // Compare encrypted passwords
        const isMatch = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isMatch) {
            res.status(401).json({ success: false, message: 'Invalid credentials.' });
            return;
        }
        // Account block/termination/suspension checks with auto-expiry for temporary blocks
        if (user.isBlocked) {
            if (user.blockedUntil && user.blockedUntil < new Date()) {
                await user_model_1.User.findByIdAndUpdate(user._id, { isBlocked: false, $unset: { blockedUntil: 1, blockType: 1 } });
            }
            else {
                const until = user.blockedUntil ? `until ${user.blockedUntil.toISOString()}` : 'permanently';
                res.status(403).json({ success: false, message: `Your account has been blocked ${until}.` });
                return;
            }
        }
        if (user.isTerminated) {
            res.status(403).json({ success: false, message: 'Your account has been terminated.' });
            return;
        }
        if (user.isSuspended) {
            res.status(403).json({ success: false, message: 'Your account has been suspended.' });
            return;
        }
        // Sign Token
        const userId = user.id ?? user._id;
        const token = generateToken(userId.toString(), user.username, user.tokenVersion ?? 0);
        const safeUser = { ...user };
        delete safeUser.passwordHash;
        res.status(200).json({
            success: true,
            message: 'Logged in successfully.',
            token,
            user: safeUser,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message || 'Error occurred during login.' });
    }
};
exports.login = login;
const googleLogin = async (req, res) => {
    try {
        const { idToken, provider = 'firebase' } = req.body;
        if (!idToken) {
            res.status(400).json({ success: false, message: 'idToken is required.' });
            return;
        }
        const result = provider === 'google'
            ? await (0, google_auth_service_1.loginWithGoogleToken)(idToken)
            : await (0, google_auth_service_1.loginWithFirebaseToken)(idToken);
        const user = await user_model_1.User.findById(result.user.id).select('-passwordHash');
        res.status(200).json({
            success: true,
            message: 'Google sign-in successful.',
            token: result.token,
            user,
        });
    }
    catch (error) {
        res.status(401).json({ success: false, message: error.message || 'Google sign-in failed.' });
    }
};
exports.googleLogin = googleLogin;
const getProfile = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const user = await (0, exports.getSafeUser)(req.user.id);
        if (!user) {
            res.status(404).json({ success: false, message: 'User profile not found.' });
            return;
        }
        res.status(200).json({
            success: true,
            user
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message || 'Error occurred while loading profile.' });
    }
};
exports.getProfile = getProfile;
const logoutAllSessions = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const user = await user_model_1.User.findById(req.user.id);
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        // Increment token version to invalidate all existing tokens
        user.tokenVersion = (user.tokenVersion || 0) + 1;
        await user.save();
        // Generate a new token for the current session so the caller stays logged in
        const newToken = generateToken(user.id, user.username, user.tokenVersion);
        res.status(200).json({
            success: true,
            message: 'Signed out of all other sessions.',
            token: newToken,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message || 'Error occurred while signing out other sessions.' });
    }
};
exports.logoutAllSessions = logoutAllSessions;
const changePassword = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            res.status(400).json({ success: false, message: 'currentPassword and newPassword are required.' });
            return;
        }
        if (String(newPassword).length < 6) {
            res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
            return;
        }
        const user = await user_model_1.User.findById(req.user.id);
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        if (user.authProvider !== 'local') {
            res.status(400).json({ success: false, message: 'Password is managed by your social login provider.' });
            return;
        }
        const ok = await bcryptjs_1.default.compare(currentPassword, user.passwordHash);
        if (!ok) {
            res.status(400).json({ success: false, message: 'Current password is incorrect.' });
            return;
        }
        const salt = await bcryptjs_1.default.genSalt(10);
        user.passwordHash = await bcryptjs_1.default.hash(newPassword, salt);
        user.tokenVersion = (user.tokenVersion || 0) + 1; // revoke other sessions
        await user.save();
        const newToken = generateToken(user.id, user.username, user.tokenVersion ?? 0);
        const safeUser = await (0, exports.getSafeUser)(user.id);
        res.status(200).json({
            success: true,
            message: 'Password updated successfully.',
            token: newToken,
            user: safeUser,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message || 'Error occurred while updating password.' });
    }
};
exports.changePassword = changePassword;
const setupTwoFactor = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const user = await user_model_1.User.findById(req.user.id);
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        const secret = speakeasy_1.default.generateSecret({
            name: `Gobilive (${user.email || user.username})`,
            length: 20,
        });
        user.twoFactorPendingSecret = secret.base32;
        await user.save();
        res.status(200).json({
            success: true,
            secret: secret.base32,
            otpauthUrl: secret.otpauth_url,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message || 'Error occurred during 2FA setup.' });
    }
};
exports.setupTwoFactor = setupTwoFactor;
const verifyTwoFactor = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const { code } = req.body;
        if (!code) {
            res.status(400).json({ success: false, message: 'code is required.' });
            return;
        }
        const user = await user_model_1.User.findById(req.user.id);
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        const pending = user.twoFactorPendingSecret;
        if (!pending) {
            res.status(400).json({ success: false, message: 'No 2FA setup in progress.' });
            return;
        }
        const ok = speakeasy_1.default.totp.verify({
            secret: pending,
            encoding: 'base32',
            token: String(code).trim(),
            window: 1,
        });
        if (!ok) {
            res.status(400).json({ success: false, message: 'Invalid code. Please try again.' });
            return;
        }
        user.twoFactorSecret = pending;
        user.twoFactorPendingSecret = undefined;
        user.twoFactorEnabled = true;
        await user.save();
        const safeUser = await (0, exports.getSafeUser)(user.id);
        res.status(200).json({ success: true, message: 'Two-factor authentication enabled.', user: safeUser });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message || 'Error occurred while enabling 2FA.' });
    }
};
exports.verifyTwoFactor = verifyTwoFactor;
const disableTwoFactor = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const { code } = req.body;
        if (!code) {
            res.status(400).json({ success: false, message: 'code is required.' });
            return;
        }
        const user = await user_model_1.User.findById(req.user.id);
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        if (!user.twoFactorEnabled || !user.twoFactorSecret) {
            res.status(400).json({ success: false, message: 'Two-factor authentication is not enabled.' });
            return;
        }
        const ok = speakeasy_1.default.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: String(code).trim(),
            window: 1,
        });
        if (!ok) {
            res.status(400).json({ success: false, message: 'Invalid code. Please try again.' });
            return;
        }
        user.twoFactorEnabled = false;
        user.twoFactorSecret = undefined;
        user.twoFactorPendingSecret = undefined;
        await user.save();
        const safeUser = await (0, exports.getSafeUser)(user.id);
        res.status(200).json({ success: true, message: 'Two-factor authentication disabled.', user: safeUser });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message || 'Error occurred while disabling 2FA.' });
    }
};
exports.disableTwoFactor = disableTwoFactor;
const linkGoogleAccount = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const { idToken } = req.body;
        if (!idToken) {
            res.status(400).json({ success: false, message: 'idToken is required.' });
            return;
        }
        const decoded = await (0, google_auth_service_1.verifyFirebaseIdToken)(idToken);
        const googleUid = decoded.uid;
        const user = await user_model_1.User.findById(req.user.id);
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        const conflict = await user_model_1.User.findOne({ googleId: googleUid, _id: { $ne: user._id } }).select('_id');
        if (conflict) {
            res.status(400).json({ success: false, message: 'This Google account is already linked to another profile.' });
            return;
        }
        user.googleId = googleUid;
        if (!user.email && decoded.email)
            user.email = decoded.email.toLowerCase();
        await user.save();
        const safeUser = await (0, exports.getSafeUser)(user.id);
        res.status(200).json({ success: true, message: 'Google account linked.', user: safeUser });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message || 'Error occurred while linking Google account.' });
    }
};
exports.linkGoogleAccount = linkGoogleAccount;
const unlinkGoogleAccount = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const user = await user_model_1.User.findById(req.user.id);
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        if (user.authProvider !== 'local') {
            res.status(400).json({
                success: false,
                message: 'This account is signed in via Google. Set a local password first before unlinking.',
            });
            return;
        }
        user.googleId = undefined;
        await user.save();
        const safeUser = await (0, exports.getSafeUser)(user.id);
        res.status(200).json({ success: true, message: 'Google account unlinked.', user: safeUser });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message || 'Error occurred while unlinking Google account.' });
    }
};
exports.unlinkGoogleAccount = unlinkGoogleAccount;
// --- Admin panel auth helpers ---
const adminLogin = async (req, res) => {
    try {
        const { identity, password } = req.body;
        if (!identity || !password) {
            res.status(400).json({ success: false, message: 'Identity and password are required.' });
            return;
        }
        const user = await user_model_1.User.findOne({
            $or: [{ username: identity }, { email: identity }, { phone: identity }],
        });
        if (!user) {
            res.status(401).json({ success: false, message: 'Invalid credentials.' });
            return;
        }
        const isMatch = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isMatch) {
            res.status(401).json({ success: false, message: 'Invalid credentials.' });
            return;
        }
        // Admin-only roles
        const adminRoles = [
            'company_admin',
            'super_admin',
            'sub_admin',
            'agency',
            'sub_agency',
            'top_up_agent',
            'reseller',
        ];
        if (!adminRoles.includes(user.role)) {
            res.status(403).json({ success: false, message: 'Admin access only.' });
            return;
        }
        // Block/termination checks (auto-expire temp blocks)
        if (user.isBlocked) {
            if (user.blockedUntil && user.blockedUntil < new Date()) {
                await user_model_1.User.findByIdAndUpdate(user._id, { isBlocked: false, $unset: { blockedUntil: 1, blockType: 1 } });
            }
            else {
                const until = user.blockedUntil ? `until ${user.blockedUntil.toISOString()}` : 'permanently';
                res.status(403).json({ success: false, message: `Your account has been blocked ${until}.` });
                return;
            }
        }
        if (user.isTerminated) {
            res.status(403).json({ success: false, message: 'Your account has been terminated.' });
            return;
        }
        if (user.isSuspended) {
            res.status(403).json({ success: false, message: 'Your account has been suspended.' });
            return;
        }
        const token = generateToken(user.id, user.username, user.tokenVersion ?? 0);
        const safeUser = await (0, exports.getSafeUser)(user.id);
        res.status(200).json({ success: true, message: 'Admin signed in.', token, user: safeUser });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message || 'Error during admin login.' });
    }
};
exports.adminLogin = adminLogin;
const adminLogout = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const user = await user_model_1.User.findById(req.user.id);
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        // Increment token version to invalidate tokens
        user.tokenVersion = (user.tokenVersion || 0) + 1;
        await user.save();
        res.status(200).json({ success: true, message: 'Signed out.' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message || 'Error during logout.' });
    }
};
exports.adminLogout = adminLogout;
// ─── Daily Reward ──────────────────────────────────────────────────────────
const claimDailyReward = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const user = await user_model_1.User.findById(req.user.id);
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        const now = new Date();
        const last = user.lastDailyRewardAt;
        if (last) {
            const hoursSince = (now.getTime() - last.getTime()) / (1000 * 60 * 60);
            if (hoursSince < 24) {
                const nextClaimAt = new Date(last.getTime() + 24 * 60 * 60 * 1000);
                res.status(400).json({
                    success: false,
                    message: 'Already claimed today.',
                    nextClaimAt,
                });
                return;
            }
        }
        // Calculate streak day (1–7, reset after 7)
        const dayRewards = [10, 20, 30, 50, 80, 100, 200];
        let streakDay = 1;
        if (last) {
            const hoursSince = (now.getTime() - last.getTime()) / (1000 * 60 * 60);
            // Within 48h keeps the streak alive; otherwise reset
            if (hoursSince <= 48) {
                const prevDay = user._streakDay ?? 0;
                streakDay = (prevDay % 7) + 1;
            }
        }
        const diamondsEarned = dayRewards[streakDay - 1];
        user.diamonds += diamondsEarned;
        user.lastDailyRewardAt = now;
        user._streakDay = streakDay;
        await user.save();
        const nextClaimAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        res.status(200).json({
            success: true,
            diamondsEarned,
            newBalance: user.diamonds,
            streakDay,
            nextClaimAt,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.claimDailyReward = claimDailyReward;
// ─── Medals ────────────────────────────────────────────────────────────────
const getMedals = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const user = await user_model_1.User.findById(req.user.id).lean();
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        const medals = [
            { id: 'first_login', name: 'First Login', earned: true },
            { id: 'rising_star', name: 'Rising Star', earned: user.level >= 5 },
            { id: 'diamond_user', name: 'Diamond User', earned: user.diamonds >= 1000 },
            { id: 'vip_member', name: 'VIP Member', earned: user.isVIP },
            { id: 'level_10', name: 'Level 10', earned: user.level >= 10 },
            { id: 'social_butterfly', name: 'Social Butterfly', earned: user.followersCount >= 100 },
        ];
        res.status(200).json({ success: true, medals });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getMedals = getMedals;
// ─── Host Application ─────────────────────────────────────────────────────────
const applyAsHost = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const { fullName, phone, country, region, agencyCode, howDidYouHear, bio } = req.body;
        if (!agencyCode?.trim()) {
            res.status(400).json({ success: false, message: 'Agency code is required' });
            return;
        }
        const existing = await registration_request_model_1.RegistrationRequest.findOne({
            'formData.parentId': req.user.id, role: 'host', status: { $in: ['pending', 'approved'] },
        });
        if (existing) {
            res.json({ success: true, status: existing.status, message: 'Application already submitted', application: existing });
            return;
        }
        const application = await registration_request_model_1.RegistrationRequest.create({
            role: 'host', status: 'pending',
            formData: { fullName: fullName || req.user.username, phone, country, region, agencyCode: agencyCode.trim(), parentId: req.user.id },
        });
        if (bio)
            await user_model_1.User.findByIdAndUpdate(req.user.id, { bio });
        res.status(201).json({ success: true, status: 'pending', application });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.applyAsHost = applyAsHost;
const getMyHostApplication = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const application = await registration_request_model_1.RegistrationRequest.findOne({ 'formData.parentId': req.user.id, role: 'host' }).sort({ createdAt: -1 }).lean();
        res.json({ success: true, application: application || null });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getMyHostApplication = getMyHostApplication;
const forgotPassword = async (req, res) => {
    try {
        const { email, identity } = req.body;
        const target = (email || identity || '').toString().trim().toLowerCase();
        if (!target) {
            res.status(400).json({ success: false, message: 'Email address or username is required.' });
            return;
        }
        const user = await user_model_1.User.findOne({
            $or: [
                { email: target },
                { username: target },
            ],
        });
        if (!user) {
            res.status(404).json({ success: false, message: 'No account found with this email or username.' });
            return;
        }
        // Generate a 6-digit OTP code for password reset
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        user.resetPasswordToken = resetCode;
        user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        await user.save({ validateModifiedOnly: true });
        // Send reset email if user has an email address and RESEND_API_KEY is set
        if (user.email && process.env.RESEND_API_KEY) {
            try {
                await (0, email_service_1.sendPasswordResetEmail)({ to: user.email, resetCode });
                console.log(`[Auth] Password reset email sent to ${user.email}`);
            }
            catch (emailErr) {
                // Email failure is non-fatal — user still gets the code in the response
                console.error('[Auth] Failed to send password reset email:', emailErr?.message);
            }
        }
        res.status(200).json({
            success: true,
            message: user.email
                ? 'Password reset code sent to your email address.'
                : 'Password reset instructions have been sent.',
            // Only expose resetCode in dev/staging — in production remove this line
            ...(process.env.NODE_ENV !== 'production' && { resetCode }),
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message || 'Failed to process forgot password request' });
    }
};
exports.forgotPassword = forgotPassword;
// ─── Find My Account ───────────────────────────────────────────────────────
// Searches by email, phone, or username and returns masked account details
const findMyAccount = async (req, res) => {
    try {
        const { query } = req.body;
        const target = (query || '').toString().trim();
        if (!target) {
            res.status(400).json({ success: false, message: 'Please enter your email, phone, or username.' });
            return;
        }
        const lowerTarget = target.toLowerCase();
        const user = await user_model_1.User.findOne({
            $or: [
                { email: lowerTarget },
                { phone: target },
                { username: lowerTarget },
            ],
        }).lean();
        if (!user) {
            res.status(404).json({ success: false, message: 'No account found. Check your input and try again.' });
            return;
        }
        // Mask email: jo***@gmail.com
        const maskEmail = (email) => {
            const [local, domain] = email.split('@');
            if (!domain)
                return email;
            const visible = local.slice(0, Math.min(2, local.length));
            return `${visible}***@${domain}`;
        };
        // Mask phone: +92***1234
        const maskPhone = (phone) => {
            if (phone.length <= 4)
                return '***';
            return `${phone.slice(0, 3)}***${phone.slice(-4)}`;
        };
        res.status(200).json({
            success: true,
            account: {
                username: user.username,
                profilePic: user.profilePic || user.avatar || '',
                maskedEmail: user.email ? maskEmail(user.email) : null,
                maskedPhone: user.phone ? maskPhone(user.phone) : null,
                hasEmail: !!user.email,
                hasPhone: !!user.phone,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message || 'Failed to find account.' });
    }
};
exports.findMyAccount = findMyAccount;
// ─── Send OTP for Account Recovery ────────────────────────────────────────
// Sends a 6-digit OTP to the chosen delivery method (email or phone)
const sendAccountRecoveryOtp = async (req, res) => {
    try {
        const { query, method } = req.body; // method: 'email' | 'phone'
        const target = (query || '').toString().trim();
        if (!target || !method) {
            res.status(400).json({ success: false, message: 'query and method are required.' });
            return;
        }
        if (!['email', 'phone'].includes(method)) {
            res.status(400).json({ success: false, message: 'method must be "email" or "phone".' });
            return;
        }
        const lowerTarget = target.toLowerCase();
        const user = await user_model_1.User.findOne({
            $or: [
                { email: lowerTarget },
                { phone: target },
                { username: lowerTarget },
            ],
        });
        if (!user) {
            res.status(404).json({ success: false, message: 'No account found.' });
            return;
        }
        // Validate chosen delivery method exists on account
        if (method === 'email' && !user.email) {
            res.status(400).json({ success: false, message: 'This account does not have an email address.' });
            return;
        }
        if (method === 'phone' && !user.phone) {
            res.status(400).json({ success: false, message: 'This account does not have a phone number.' });
            return;
        }
        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.resetPasswordToken = otp;
        user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 min
        await user.save({ validateModifiedOnly: true });
        if (method === 'email' && user.email && process.env.RESEND_API_KEY) {
            try {
                await (0, email_service_1.sendPasswordResetEmail)({ to: user.email, resetCode: otp });
                console.log(`[Auth] Recovery OTP sent to ${user.email}`);
            }
            catch (emailErr) {
                console.error('[Auth] Failed to send recovery OTP email:', emailErr?.message);
            }
        }
        // Phone OTP — log for now (integrate Twilio/Firebase when SMS service ready)
        if (method === 'phone') {
            console.log(`[Auth] Phone OTP for ${user.phone}: ${otp}`);
            // TODO: integrate SMS service here (Twilio, Firebase, etc.)
        }
        res.status(200).json({
            success: true,
            message: method === 'email'
                ? 'OTP sent to your email address.'
                : 'OTP sent to your phone number.',
            ...(process.env.NODE_ENV !== 'production' && { otp }),
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message || 'Failed to send OTP.' });
    }
};
exports.sendAccountRecoveryOtp = sendAccountRecoveryOtp;
// ─── Verify OTP & Reset Password ──────────────────────────────────────────
// Verifies OTP and sets a new password for account recovery
const verifyOtpAndResetPassword = async (req, res) => {
    try {
        const { query, otp, newPassword } = req.body;
        const target = (query || '').toString().trim();
        if (!target || !otp || !newPassword) {
            res.status(400).json({ success: false, message: 'query, otp, and newPassword are required.' });
            return;
        }
        if (String(newPassword).length < 6) {
            res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
            return;
        }
        const lowerTarget = target.toLowerCase();
        const user = await user_model_1.User.findOne({
            $or: [
                { email: lowerTarget },
                { phone: target },
                { username: lowerTarget },
            ],
        });
        if (!user) {
            res.status(404).json({ success: false, message: 'No account found.' });
            return;
        }
        // Validate OTP
        if (!user.resetPasswordToken || user.resetPasswordToken !== String(otp).trim()) {
            res.status(400).json({ success: false, message: 'Invalid OTP. Please check and try again.' });
            return;
        }
        if (user.resetPasswordExpires && user.resetPasswordExpires < new Date()) {
            res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
            return;
        }
        // Update password
        const salt = await bcryptjs_1.default.genSalt(10);
        user.passwordHash = await bcryptjs_1.default.hash(newPassword, salt);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        user.tokenVersion = (user.tokenVersion || 0) + 1;
        await user.save();
        res.status(200).json({
            success: true,
            message: 'Password reset successfully. You can now log in.',
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message || 'Failed to reset password.' });
    }
};
exports.verifyOtpAndResetPassword = verifyOtpAndResetPassword;
const resetPassword = async (req, res) => {
    try {
        const { email, identity, code, newPassword } = req.body;
        const target = (email || identity || '').toString().trim().toLowerCase();
        if (!target || !newPassword) {
            res.status(400).json({ success: false, message: 'Email and new password are required.' });
            return;
        }
        if (String(newPassword).length < 6) {
            res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
            return;
        }
        const user = await user_model_1.User.findOne({
            $or: [
                { email: target },
                { username: target },
            ],
        });
        if (!user) {
            res.status(404).json({ success: false, message: 'No account found with this email address.' });
            return;
        }
        if (code && user.resetPasswordToken && user.resetPasswordToken !== String(code).trim()) {
            res.status(400).json({ success: false, message: 'Invalid or expired password reset code.' });
            return;
        }
        const salt = await bcryptjs_1.default.genSalt(10);
        user.passwordHash = await bcryptjs_1.default.hash(newPassword, salt);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        user.tokenVersion = (user.tokenVersion || 0) + 1; // Revoke existing tokens
        await user.save();
        res.status(200).json({
            success: true,
            message: 'Password reset successfully. You can now log in with your new password.',
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message || 'Failed to reset password.' });
    }
};
exports.resetPassword = resetPassword;
