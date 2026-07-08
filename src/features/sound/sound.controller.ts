import { Request, Response } from 'express';
import { Sound } from './sound.model';

// GET /api/sounds
export const getSounds = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const genre = req.query.genre as string | undefined;
    const q = req.query.q as string | undefined;

    const filter: any = { isActive: true };
    if (genre && genre !== 'all') filter.genre = genre;
    if (q) filter.$text = { $search: q };

    const skip = (page - 1) * limit;
    const [sounds, total] = await Promise.all([
      Sound.find(filter).sort({ usageCount: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      Sound.countDocuments(filter),
    ]);

    res.json({ success: true, sounds, total, page, pages: Math.ceil(total / limit) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/sounds/:id
export const getSoundById = async (req: Request, res: Response) => {
  try {
    const sound = await Sound.findById(req.params.id).lean();
    if (!sound) return res.status(404).json({ success: false, message: 'Sound not found' });
    res.json({ success: true, sound });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/sounds — admin only
export const createSound = async (req: Request, res: Response) => {
  try {
    const sound = await Sound.create(req.body);
    res.status(201).json({ success: true, sound });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// POST /api/sounds/:id/use — increment usageCount
export const useSound = async (req: Request, res: Response) => {
  try {
    await Sound.findByIdAndUpdate(req.params.id, { $inc: { usageCount: 1 } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
