import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, UserRole } from '../auth/user.model';

const ADMIN_ROLES: UserRole[] = [
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

export const adminLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, phone, password } = req.body;

    if (!password || (!email && !phone)) {
      res.status(400).json({ success: false, message: 'Email/phone and password are required.' });
      return;
    }

    const query = email
      ? { email: email.toLowerCase().trim() }
      : { phone: phone.trim() };

    const user = await User.findOne(query).select(
      '+passwordHash role isBlocked blockedUntil isTerminated isSuspended tokenVersion'
    );

    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid credentials.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
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
        await User.findByIdAndUpdate(user._id, {
          isBlocked: false,
          $unset: { blockedUntil: 1, blockType: 1 },
        });
      } else {
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

    const token = jwt.sign(
      { id: user._id.toString(), username: user.username, role: user.role, tokenVersion: user.tokenVersion },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN } as any
    );

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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const adminLogout = async (req: Request, res: Response): Promise<void> => {
  // Increment tokenVersion to invalidate all existing JWTs for this user
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
      await User.findByIdAndUpdate(decoded.id, { $inc: { tokenVersion: 1 } });
    }
    res.status(200).json({ success: true, message: 'Logged out successfully.' });
  } catch {
    res.status(200).json({ success: true, message: 'Logged out.' });
  }
};
