import { Response } from 'express';
import { Agency } from './agency.model';
import { User } from '../auth/user.model';
import { AuthRequest } from '../../core/middlewares/auth.middleware';

export const getMyAgency = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const agency = await Agency.findOne({ ownerId: req.user.id });
    res.status(200).json({ success: true, agency });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createAgency = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const { name } = req.body;
    const existing = await Agency.findOne({ ownerId: req.user.id });
    if (existing) {
      res.status(400).json({ success: false, message: 'You already have an agency.' });
      return;
    }

    const user = await User.findById(req.user.id);
    const agency = await Agency.create({
      name,
      ownerId: req.user.id,
      ownerUsername: user?.username,
    });

    await User.findByIdAndUpdate(req.user.id, { role: 'agency', agencyId: agency.id });

    res.status(201).json({ success: true, agency });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const addStreamerToAgency = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const { streamerUsername } = req.body;
    const agency = await Agency.findOne({ ownerId: req.user.id });
    if (!agency) {
      res.status(404).json({ success: false, message: 'Agency not found.' });
      return;
    }

    const streamer = await User.findOne({ username: streamerUsername });
    if (!streamer) {
      res.status(404).json({ success: false, message: 'Streamer not found.' });
      return;
    }

    if (!agency.streamerIds.includes(streamer.id)) {
      agency.streamerIds.push(streamer.id);
      await agency.save();
    }

    res.status(200).json({ success: true, agency });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
