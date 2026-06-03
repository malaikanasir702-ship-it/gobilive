import { Response } from 'express';
import { User } from '../auth/user.model';
import { AuthRequest } from '../../core/middlewares/auth.middleware';

export const searchUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const q = (req.query.q as string || '').trim();
    if (!q || q.length < 2) {
      res.status(400).json({ success: false, message: 'Query must be at least 2 characters.' });
      return;
    }

    const users = await User.find({
      username: { $regex: q, $options: 'i' },
    })
      .select('username bio profilePic level isVIP badges followersCount')
      .limit(30)
      .lean();

    if (req.user) {
      await User.findByIdAndUpdate(req.user.id, {
        $push: {
          searchHistory: {
            $each: [q],
            $position: 0,
            $slice: 20,
          },
        },
      });
    }

    res.status(200).json({ success: true, users });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSearchHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const user = await User.findById(req.user.id).select('searchHistory');
    res.status(200).json({ success: true, history: user?.searchHistory ?? [] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const clearSearchHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    await User.findByIdAndUpdate(req.user.id, { searchHistory: [] });
    res.status(200).json({ success: true, message: 'Search history cleared.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTrendingUsers = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await User.find()
      .sort({ followersCount: -1, level: -1 })
      .select('username bio profilePic level isVIP badges followersCount')
      .limit(20)
      .lean();

    res.status(200).json({ success: true, users });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
