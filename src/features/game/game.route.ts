import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../../core/middlewares/auth.middleware';
import { getSpinConfig, spinWheel } from './game.controller';
import { playTeenPatti, getTeenPattiConfig } from './teen-patti.controller';
import { rollDice, getDiceConfig } from './dice.controller';
import { dropPlinko, getPlinkoConfig } from './plinko.controller';
import { GameHistory } from './game-history.model';
import { AuthRequest } from '../../core/middlewares/auth.middleware';

const router = Router();

// ── Spin Wheel ──────────────────────────────────────────────────────────────
router.get('/spin/config', authenticateJWT as any, getSpinConfig as any);
router.post('/spin',       authenticateJWT as any, spinWheel as any);

// ── Teen Patti ──────────────────────────────────────────────────────────────
router.get('/teen-patti/config', authenticateJWT as any, getTeenPattiConfig as any);
router.post('/teen-patti/play',  authenticateJWT as any, playTeenPatti as any);

// ── Dice Roll ───────────────────────────────────────────────────────────────
router.get('/dice/config', authenticateJWT as any, getDiceConfig as any);
router.post('/dice/roll',  authenticateJWT as any, rollDice as any);

// ── Plinko ──────────────────────────────────────────────────────────────────
router.get('/plinko/config', authenticateJWT as any, getPlinkoConfig as any);
router.post('/plinko/drop',  authenticateJWT as any, dropPlinko as any);

// ── Game History (all games, paginated) ─────────────────────────────────────
router.get('/history', authenticateJWT as any, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized.' }); return; }
    const page   = Math.max(1, parseInt(String(req.query.page  ?? 1)));
    const limit  = Math.min(50, parseInt(String(req.query.limit ?? 20)));
    const type   = req.query.type as string | undefined;
    const filter: Record<string, unknown> = { userId: req.user.id };
    if (type) filter.gameType = type;

    const [items, total] = await Promise.all([
      GameHistory.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      GameHistory.countDocuments(filter),
    ]);
    res.json({ success: true, items, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
