import { Request, Response } from 'express';
import { GameConfig } from '../game/game-config.model';
import WalletTransaction from '../wallet/wallet.transaction.model';
import { logActivity } from '../activity-log/activity-log.service';

const BUILTIN_GAMES = [
  { gameId: 'spin',       name: 'Lucky Spin',   description: 'Daily spin wheel for diamonds' },
  { gameId: 'teen_patti', name: 'Teen Patti',   description: '3-card poker vs dealer. Bet 10–500 💎' },
  { gameId: 'dice',       name: 'Dice Roll',    description: 'Roll 2 dice — Over/Under/Exact. Bet 10–500 💎' },
  { gameId: 'plinko',     name: 'Plinko',       description: 'Drop a ball through pegs. Bet 10–500 💎' },
];

export async function listGames(_req: Request, res: Response) {
  try {
    const configs = await GameConfig.find().lean();
    const merged = BUILTIN_GAMES.map(g => ({
      ...g,
      ...(configs.find(c => c.gameId === g.gameId) || { enabled: true }),
    }));
    res.json({ success: true, data: merged });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getGame(req: Request, res: Response) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Game id is required' });
    }

    const builtin = BUILTIN_GAMES.find(g => g.gameId === id);
    const config = await GameConfig.findOne({ gameId: id }).lean();
    if (!builtin && !config) return res.status(404).json({ success: false, message: 'Game not found' });
    res.json({ success: true, data: { ...(builtin || {}), ...(config || {}) } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateGame(req: Request, res: Response) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Game id is required' });
    }
    const { enabled, name, meta } = req.body;
    const adminUser = (req as any).adminUser;

    const cfg = await GameConfig.findOneAndUpdate(
      { gameId: id },
      { $set: { ...(name !== undefined && { name }), ...(enabled !== undefined && { enabled }), ...(meta !== undefined && { meta }) } },
      { upsert: true, new: true }
    );

    await logActivity({
      actorId: adminUser?.id, actorRole: adminUser?.role || 'company_admin',
      actionType: 'update_game', targetEntityType: 'GameConfig', targetEntityId: String(id),
      description: `Updated game "${id}" config`,
    });

    res.json({ success: true, data: cfg });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getGameStats(_req: Request, res: Response) {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);

    const txAgg = await WalletTransaction.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: '$type',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({ success: true, data: { txSummary: txAgg, note: 'Full game stats available after third-party API integration' } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export default {};
