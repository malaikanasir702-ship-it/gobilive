import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../../features/auth/user.model';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
  };
}

export const authenticateJWT = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Authorization token required' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_gobilive_token_key_123!') as {
      id: string;
      username: string;
      tokenVersion?: number;
    };
    
    // Check token version (for "sign out of all other sessions")
    const dbUser = await User.findById(decoded.id).select('isSuspended tokenVersion');
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
  } catch (error) {
    res.status(403).json({ success: false, message: 'Invalid or expired authorization token' });
  }
};

