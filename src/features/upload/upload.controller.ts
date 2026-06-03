import { Response } from 'express';
import { AuthRequest } from '../../core/middlewares/auth.middleware';

export const uploadFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const file = (req as AuthRequest & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ success: false, message: 'No file uploaded.' });
      return;
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const url = `${baseUrl}/uploads/${file.filename}`;

    res.status(201).json({
      success: true,
      url,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
