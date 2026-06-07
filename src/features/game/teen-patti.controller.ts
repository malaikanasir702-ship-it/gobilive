import crypto from 'crypto';
import { Response } from 'express';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { User } from '../auth/user.model';
import { GameHistory } from './game-history.model';

// ─── Card types ───────────────────────────────────────────────────────────────
type Suit = 'S' | 'H' | 'D' | 'C';   // Spades, Hearts, Diamonds, Clubs
type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

interface Card { suit: Suit; rank: Rank; }

const SUITS: Suit[]  = ['S', 'H', 'D', 'C'];
const RANKS: Rank[]  = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RANK_VAL: Record<Rank, number> = {
  A: 14, K: 13, Q: 12, J: 11, '10': 10, '9': 9, '8': 8, '7': 7,
  '6': 6, '5': 5, '4': 4, '3': 3, '2': 2,
};

// ─── Game config ──────────────────────────────────────────────────────────────
const MIN_BET  = 10;
const MAX_BET  = 500;

// ─── Hand Rankings (higher = better) ─────────────────────────────────────────
type HandRank = 'high_card' | 'pair' | 'flush' | 'straight' | 'straight_flush' | 'trio';

const HAND_ORDER: HandRank[] = ['high_card', 'pair', 'flush', 'straight', 'straight_flush', 'trio'];

function handScore(rank: HandRank): number {
  return HAND_ORDER.indexOf(rank);
}

// ─── Deck helpers ─────────────────────────────────────────────────────────────
function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ suit, rank });
  return deck;
}

function secureShuffle<T>(arr: T[]): T[] {
  // Fisher-Yates with crypto.randomInt
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function deal(deck: Card[], n: number): [Card[], Card[]] {
  return [deck.slice(0, n), deck.slice(n)];
}

// ─── Hand evaluation ──────────────────────────────────────────────────────────
function evalHand(cards: Card[]): { rank: HandRank; highCard: number } {
  const [c1, c2, c3] = cards;
  const vals = cards.map(c => RANK_VAL[c.rank]).sort((a, b) => b - a);
  const sameSuit = c1.suit === c2.suit && c2.suit === c3.suit;

  // Trio
  if (vals[0] === vals[1] && vals[1] === vals[2]) return { rank: 'trio', highCard: vals[0] };

  // Straight (consecutive + handle A-2-3 wheel)
  const isConsec = (vals[0] - vals[1] === 1 && vals[1] - vals[2] === 1)
    || (vals[0] === 14 && vals[1] === 3 && vals[2] === 2); // A-2-3
  if (isConsec && sameSuit) return { rank: 'straight_flush', highCard: vals[0] };
  if (isConsec)             return { rank: 'straight',       highCard: vals[0] };
  if (sameSuit)             return { rank: 'flush',          highCard: vals[0] };

  // Pair
  if (vals[0] === vals[1] || vals[1] === vals[2]) return { rank: 'pair', highCard: vals[0] };

  return { rank: 'high_card', highCard: vals[0] };
}

function compareHands(player: Card[], dealer: Card[]): 'player' | 'dealer' | 'tie' {
  const ph = evalHand(player);
  const dh = evalHand(dealer);

  const ps = handScore(ph.rank);
  const ds = handScore(dh.rank);

  if (ps > ds) return 'player';
  if (ds > ps) return 'dealer';
  // Same rank — compare high card
  if (ph.highCard > dh.highCard) return 'player';
  if (dh.highCard > ph.highCard) return 'dealer';
  return 'dealer'; // dealer wins ties (house edge)
}

// ─── Payout table ─────────────────────────────────────────────────────────────
const PAYOUT: Record<HandRank, number> = {
  high_card:     1.8,
  pair:          2.0,
  flush:         3.0,
  straight:      4.0,
  straight_flush: 6.0,
  trio:          10.0,
};

// ─── Controller ───────────────────────────────────────────────────────────────
export const playTeenPatti = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized.' }); return; }

    const bet = Number(req.body.bet);
    if (!bet || bet < MIN_BET || bet > MAX_BET) {
      res.status(400).json({ success: false, message: `Bet must be ${MIN_BET}–${MAX_BET} 💎.` });
      return;
    }

    const user = await User.findById(req.user.id);
    if (!user) { res.status(404).json({ success: false, message: 'User not found.' }); return; }
    if ((user.diamonds ?? 0) < bet) {
      res.status(400).json({ success: false, message: 'Insufficient diamonds.' });
      return;
    }

    // Deal
    const deck = secureShuffle(buildDeck());
    const [playerCards, rest] = deal(deck, 3);
    const [dealerCards]       = deal(rest, 3);

    const winner  = compareHands(playerCards, dealerCards);
    const ph      = evalHand(playerCards);
    const payout  = winner === 'player' ? Math.floor(bet * PAYOUT[ph.rank]) : 0;
    const outcome = winner === 'player' ? 'win' : winner === 'tie' ? 'tie' : 'loss';

    // Update balance
    user.diamonds -= bet;
    user.diamonds += payout;
    await user.save();

    // Persist history
    await GameHistory.create({
      userId:        user._id,
      gameType:      'teen_patti',
      betAmount:     bet,
      payout,
      netDelta:      payout - bet,
      outcome,
      meta:          { playerCards, dealerCards, playerHand: ph.rank, winner },
      diamondsAfter: user.diamonds,
    });

    res.status(200).json({
      success: true,
      playerCards,
      dealerCards,
      playerHand: ph.rank,
      winner,
      bet,
      payout,
      netDelta: payout - bet,
      user: { diamonds: user.diamonds },
    });
  } catch (err: any) {
    console.error('[TeenPatti]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getTeenPattiConfig = (_req: AuthRequest, res: Response): void => {
  res.json({
    success: true,
    minBet: MIN_BET,
    maxBet: MAX_BET,
    payouts: PAYOUT,
    bettingChips: [10, 25, 50, 100, 250, 500],
  });
};
