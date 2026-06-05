import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import { User } from './user.model';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { loginWithFirebaseToken, loginWithGoogleToken, verifyFirebaseIdToken } from './google-auth.service';

// Helpers to generate tokens
const generateToken = (userId: string, username: string, tokenVersion = 0): string => {
  return jwt.sign(
    { id: userId, username, tokenVersion },
    process.env.JWT_SECRET || 'super_secret_gobilive_token_key_123!',
    { expiresIn: '30d' } // Extended expiration for mobile devices
  );
};

const getSafeUser = async (userId: string) => {
  // Keep app responses consistent and always exclude password hash.
  return User.findById(userId).select('-passwordHash');
};

export const register = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { username, email, phone, password } = req.body;

    if (!username || !password || (!email && !phone)) {
      res.status(400).json({ success: false, message: 'Username, password, and either email or phone are required.' });
      return;
    }

    // Check duplicate username
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      res.status(400).json({ success: false, message: 'Username is already taken.' });
      return;
    }

    // Check duplicate email
    if (email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        res.status(400).json({ success: false, message: 'Email is already registered.' });
        return;
      }
    }

    // Check duplicate phone
    if (phone) {
      const existingPhone = await User.findOne({ phone });
      if (existingPhone) {
        res.status(400).json({ success: false, message: 'Phone number is already registered.' });
        return;
      }
    }

    // Hashing password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const newUser = new User({
      username,
      email,
      phone,
      passwordHash
    });

    await newUser.save();

    // Sign Token
    const token = generateToken(newUser.id, newUser.username, newUser.tokenVersion ?? 0);
    const safeUser = await getSafeUser(newUser.id);

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      token,
      user: safeUser,
    });

  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error occurred during registration.' });
  }
};

export const login = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { identity, password } = req.body; // identity can be email, phone or username

    if (!identity || !password) {
      res.status(400).json({ success: false, message: 'Identity and password fields are required.' });
      return;
    }

    // Locate user by username, email or phone
    const user = await User.findOne({
      $or: [
        { username: identity },
        { email: identity },
        { phone: identity }
      ]
    });

    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid credentials.' });
      return;
    }

    // Compare encrypted passwords
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid credentials.' });
      return;
    }

    // Account block/termination/suspension checks with auto-expiry for temporary blocks
    if (user.isBlocked) {
      if (user.blockedUntil && user.blockedUntil < new Date()) {
        await User.findByIdAndUpdate(user._id, { isBlocked: false, $unset: { blockedUntil: 1, blockType: 1 } });
      } else {
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
    const token = generateToken(user.id, user.username, user.tokenVersion ?? 0);
    const safeUser = await getSafeUser(user.id);

    res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      token,
      user: safeUser,
    });

  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error occurred during login.' });
  }
};

export const googleLogin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { idToken, provider = 'firebase' } = req.body;
    if (!idToken) {
      res.status(400).json({ success: false, message: 'idToken is required.' });
      return;
    }

    const result =
      provider === 'google'
        ? await loginWithGoogleToken(idToken)
        : await loginWithFirebaseToken(idToken);

    const user = await User.findById(result.user.id).select('-passwordHash');
    res.status(200).json({
      success: true,
      message: 'Google sign-in successful.',
      token: result.token,
      user,
    });
  } catch (error: any) {
    res.status(401).json({ success: false, message: error.message || 'Google sign-in failed.' });
  }
};

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const user = await User.findById(req.user.id).select('-passwordHash');

    if (!user) {
      res.status(404).json({ success: false, message: 'User profile not found.' });
      return;
    }

    res.status(200).json({
      success: true,
      user
    });

  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error occurred while loading profile.' });
  }
};

export const logoutAllSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const user = await User.findById(req.user.id);
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error occurred while signing out other sessions.' });
  }
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      res.status(400).json({ success: false, message: 'currentPassword and newPassword are required.' });
      return;
    }

    if (String(newPassword).length < 6) {
      res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
      return;
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    if (user.authProvider !== 'local') {
      res.status(400).json({ success: false, message: 'Password is managed by your social login provider.' });
      return;
    }

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      res.status(400).json({ success: false, message: 'Current password is incorrect.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    user.tokenVersion = (user.tokenVersion || 0) + 1; // revoke other sessions
    await user.save();

    const newToken = generateToken(user.id, user.username, user.tokenVersion ?? 0);
    const safeUser = await getSafeUser(user.id);

    res.status(200).json({
      success: true,
      message: 'Password updated successfully.',
      token: newToken,
      user: safeUser,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error occurred while updating password.' });
  }
};

export const setupTwoFactor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    const secret = speakeasy.generateSecret({
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error occurred during 2FA setup.' });
  }
};

export const verifyTwoFactor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const { code } = req.body as { code?: string };
    if (!code) {
      res.status(400).json({ success: false, message: 'code is required.' });
      return;
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    const pending = user.twoFactorPendingSecret;
    if (!pending) {
      res.status(400).json({ success: false, message: 'No 2FA setup in progress.' });
      return;
    }

    const ok = speakeasy.totp.verify({
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

    const safeUser = await getSafeUser(user.id);
    res.status(200).json({ success: true, message: 'Two-factor authentication enabled.', user: safeUser });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error occurred while enabling 2FA.' });
  }
};

export const disableTwoFactor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const { code } = req.body as { code?: string };
    if (!code) {
      res.status(400).json({ success: false, message: 'code is required.' });
      return;
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      res.status(400).json({ success: false, message: 'Two-factor authentication is not enabled.' });
      return;
    }

    const ok = speakeasy.totp.verify({
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

    const safeUser = await getSafeUser(user.id);
    res.status(200).json({ success: true, message: 'Two-factor authentication disabled.', user: safeUser });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error occurred while disabling 2FA.' });
  }
};

export const linkGoogleAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const { idToken } = req.body as { idToken?: string };
    if (!idToken) {
      res.status(400).json({ success: false, message: 'idToken is required.' });
      return;
    }

    const decoded = await verifyFirebaseIdToken(idToken);
    const googleUid = decoded.uid;

    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    const conflict = await User.findOne({ googleId: googleUid, _id: { $ne: user._id } }).select('_id');
    if (conflict) {
      res.status(400).json({ success: false, message: 'This Google account is already linked to another profile.' });
      return;
    }

    user.googleId = googleUid;
    if (!user.email && decoded.email) user.email = decoded.email.toLowerCase();
    await user.save();

    const safeUser = await getSafeUser(user.id);
    res.status(200).json({ success: true, message: 'Google account linked.', user: safeUser });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error occurred while linking Google account.' });
  }
};

export const unlinkGoogleAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const user = await User.findById(req.user.id);
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

    const safeUser = await getSafeUser(user.id);
    res.status(200).json({ success: true, message: 'Google account unlinked.', user: safeUser });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error occurred while unlinking Google account.' });
  }
};

// --- Admin panel auth helpers ---
export const adminLogin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { identity, password } = req.body;
    if (!identity || !password) {
      res.status(400).json({ success: false, message: 'Identity and password are required.' });
      return;
    }

    const user = await User.findOne({
      $or: [{ username: identity }, { email: identity }, { phone: identity }],
    });

    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid credentials.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
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
        await User.findByIdAndUpdate(user._id, { isBlocked: false, $unset: { blockedUntil: 1, blockType: 1 } });
      } else {
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
    const safeUser = await getSafeUser(user.id);

    res.status(200).json({ success: true, message: 'Admin signed in.', token, user: safeUser });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error during admin login.' });
  }
};

export const adminLogout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }
    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    // Increment token version to invalidate tokens
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    res.status(200).json({ success: true, message: 'Signed out.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error during logout.' });
  }
};
