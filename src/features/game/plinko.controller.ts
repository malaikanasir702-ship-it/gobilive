import crypto from 'crypto';
import { Response } from 'express';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { User } from '../auth/user.model';
import { GameHistory } from './game-history.model';

const MIN_BET  = 10;
const MAX_BET  = 500;
const ROWS     = 8;

// ─── Slot multipliers (9 slots for 8-row board) ───────────────────────────────
// Symmetric bell-curve distribution (outer = high risk, center = low risk)
const SLOT_MULTIPLIERS = [10.0, 3.0, 1.5, 1.0, 0.5, 1.0, 1.5, 3.0, 10.0];
// Slot labels for UI display
const SLOT_LABELS      = ['10×', '3×', '1.5×', '1×', '0.5×', '1×', '1.5×', '3×', '10×'];

// Risk tiers adjustments (admin configurable in future)
// 'low' = center-biased, 'high' = edge-biased (via weighted path)
// For now we use uniform random path (fair bell curve naturally emerges)

export const dropPlinko = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized.' }); return; }

    const bet = Number(req.body.bet);
    if (!bet || bet < MIN_BET || bet > MAX_BET) {
      res.status(400).json({ success: false, message: `Bet must be ${MIN_BET}–${MAX_BET} 💎.` }); return;
    }

    const user = await User.findById(req.user.id);
    if (!user) { res.status(404).json({ success: false, message: 'User not found.' }); return; }
    if ((user.diamonds ?? 0) < bet) {
      res.status(400).json({ success: false, message: 'Insufficient diamonds.' }); return;
    }

    // Simulate ball path — each row: 0 = go left, 1 = go right
    const path: number[] = [];
    for (let r = 0; r < ROWS; r++) {
      path.push(crypto.randomInt(0, 2)); // 0 or 1
    }

    // Calculate final slot index (sum of right moves = slot position)
    const slotIndex = path.reduce((acc, v) => acc + v, 0); // 0–8
    const multiplier = SLOT_MULTIPLIERS[slotIndex];
    const payout     = Math.floor(bet * multiplier);
    const outcome    = payout >= bet ? 'win' : 'loss';

    user.diamonds -= bet;
    user.diamonds += payout;
    await user.save();

    await GameHistory.create({
      userId:        user._id,
      gameType:      'plinko',
      betAmount:     bet,
      payout,
      netDelta:      payout - bet,
      outcome,
      meta:          { path, slotIndex, multiplier, slotLabel: SLOT_LABELS[slotIndex] },
      diamondsAfter: user.diamonds,
    });

    res.status(200).json({
      success: true,
      path,           // [0,1,0,1,1,0,1,0] — Flutter animates this step by step
      slotIndex,
      slotLabel:     SLOT_LABELS[slotIndex],
      multiplier,
      bet,
      payout,
      netDelta:      payout - bet,
      user: { diamonds: user.diamonds },
    });
  } catch (err: any) {
    console.error('[Plinko]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getPlinkoConfig = (_req: AuthRequest, res: Response): void => {
  res.json({
    success: true,
    rows:           ROWS,
    slots:          SLOT_MULTIPLIERS.length,
    multipliers:    SLOT_MULTIPLIERS,
    labels:         SLOT_LABELS,
    minBet:         MIN_BET,
    maxBet:         MAX_BET,
    bettingChips:   [10, 25, 50, 100, 250, 500],
  });
};
