import { Request, Response } from 'express';
import { Template } from './template.model';

// GET /api/templates
export const getTemplates = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const category = req.query.category as string | undefined;

    const filter: any = { isActive: true };
    if (category && category !== 'for_you') filter.category = category;

    const skip = (page - 1) * limit;
    const [templates, total] = await Promise.all([
      Template.find(filter)
        .populate('soundId', 'title artist url coverUrl duration')
        .sort({ usageCount: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Template.countDocuments(filter),
    ]);

    res.json({ success: true, templates, total, page, pages: Math.ceil(total / limit) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/templates/:id
export const getTemplateById = async (req: Request, res: Response) => {
  try {
    const template = await Template.findById(req.params.id)
      .populate('soundId', 'title artist url coverUrl duration')
      .lean();
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
    res.json({ success: true, template });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/templates — admin only
export const createTemplate = async (req: Request, res: Response) => {
  try {
    const template = await Template.create(req.body);
    res.status(201).json({ success: true, template });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// POST /api/templates/:id/use
export const useTemplate = async (req: Request, res: Response) => {
  try {
    await Template.findByIdAndUpdate(req.params.id, { $inc: { usageCount: 1 } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
