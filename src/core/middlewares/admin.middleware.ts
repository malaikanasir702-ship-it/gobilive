import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';

export const authenticateAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const adminKey = req.headers['x-admin-key'] as string | undefined;
  const expected = process.env.ADMIN_API_KEY || 'gobilive_admin_dev_key';

  if (!adminKey || adminKey !== expected) {
    res.status(403).json({ success: false, message: 'Admin access denied.' });
    return;
  }

  next();
};
