import crypto from 'crypto';
import { Response } from 'express';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { User } from '../auth/user.model';
import { GameHistory } from './game-history.model';

const MIN_BET = 10;
const MAX_BET = 500;

// ─── Bet types ────────────────────────────────────────────────────────────────
type BetType = 'over' | 'under' | 'exact';

interface DiceBetPayload {
  bet: number;
  betType: BetType;
  exactSum?: number; // required when betType === 'exact'
}

// ─── Payout multipliers (house edge built in) ─────────────────────────────────
// Over/Under: true prob ≈ 15/36 = 41.7%, payout 1.85x → house edge ~5.7%
// Exact sum payouts: fair payout × 0.9 (10% house edge)
const EXACT_PAYOUT: Record<number, number> = {
  2:  29, 3: 14, 4:  9, 5:  7, 6: 5,
  7:   5, 8:  5, 9:  7, 10: 9, 11: 14, 12: 29,
};

const OVER_UNDER_PAYOUT = 1.85;

function rollDie(): number {
  return crypto.randomInt(1, 7); // 1-6 inclusive
}

export const rollDice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized.' }); return; }

    const { bet, betType, exactSum } = req.body as DiceBetPayload;

    if (!bet || bet < MIN_BET || bet > MAX_BET) {
      res.status(400).json({ success: false, message: `Bet must be ${MIN_BET}–${MAX_BET} 💎.` }); return;
    }
    if (!['over', 'under', 'exact'].includes(betType)) {
      res.status(400).json({ success: false, message: 'Invalid bet type.' }); return;
    }
    if (betType === 'exact' && (!exactSum || exactSum < 2 || exactSum > 12)) {
      res.status(400).json({ success: false, message: 'exactSum must be 2–12.' }); return;
    }

    const user = await User.findById(req.user.id);
    if (!user) { res.status(404).json({ success: false, message: 'User not found.' }); return; }
    if ((user.diamonds ?? 0) < bet) {
      res.status(400).json({ success: false, message: 'Insufficient diamonds.' }); return;
    }

    const d1 = rollDie();
    const d2 = rollDie();
    const sum = d1 + d2;

    let won = false;
    let multiplier = 0;

    if (betType === 'over')  { won = sum > 7;  multiplier = OVER_UNDER_PAYOUT; }
    if (betType === 'under') { won = sum < 7;  multiplier = OVER_UNDER_PAYOUT; }
    if (betType === 'exact') { won = sum === exactSum!; multiplier = EXACT_PAYOUT[sum] ?? 1; }

    const payout  = won ? Math.floor(bet * multiplier) : 0;
    const outcome = won ? 'win' : 'loss';

    user.diamonds -= bet;
    user.diamonds += payout;
    await user.save();

    await GameHistory.create({
      userId:        user._id,
      gameType:      'dice',
      betAmount:     bet,
      payout,
      netDelta:      payout - bet,
      outcome,
      meta:          { d1, d2, sum, betType, exactSum: exactSum ?? null, multiplier },
      diamondsAfter: user.diamonds,
    });

    res.status(200).json({
      success: true,
      dice: [d1, d2],
      sum,
      betType,
      exactSum: exactSum ?? null,
      won,
      multiplier,
      bet,
      payout,
      netDelta: payout - bet,
      user: { diamonds: user.diamonds },
    });
  } catch (err: any) {
    console.error('[Dice]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getDiceConfig = (_req: AuthRequest, res: Response): void => {
  res.json({
    success: true,
    minBet: MIN_BET,
    maxBet: MAX_BET,
    bettingChips: [10, 25, 50, 100, 250, 500],
    exactPayouts: EXACT_PAYOUT,
    overUnderPayout: OVER_UNDER_PAYOUT,
  });
};
