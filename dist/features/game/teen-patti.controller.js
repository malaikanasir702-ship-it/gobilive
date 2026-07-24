"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTeenPattiConfig = exports.playTeenPatti = void 0;
const crypto_1 = __importDefault(require("crypto"));
const user_model_1 = require("../auth/user.model");
const game_history_model_1 = require("./game-history.model");
const SUITS = ['S', 'H', 'D', 'C'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RANK_VAL = {
    A: 14, K: 13, Q: 12, J: 11, '10': 10, '9': 9, '8': 8, '7': 7,
    '6': 6, '5': 5, '4': 4, '3': 3, '2': 2,
};
// ─── Game config ──────────────────────────────────────────────────────────────
const MIN_BET = 10;
const MAX_BET = 500;
const HAND_ORDER = ['high_card', 'pair', 'flush', 'straight', 'straight_flush', 'trio'];
function handScore(rank) {
    return HAND_ORDER.indexOf(rank);
}
// ─── Deck helpers ─────────────────────────────────────────────────────────────
function buildDeck() {
    const deck = [];
    for (const suit of SUITS)
        for (const rank of RANKS)
            deck.push({ suit, rank });
    return deck;
}
function secureShuffle(arr) {
    // Fisher-Yates with crypto.randomInt
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = crypto_1.default.randomInt(0, i + 1);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
function deal(deck, n) {
    return [deck.slice(0, n), deck.slice(n)];
}
// ─── Hand evaluation ──────────────────────────────────────────────────────────
function evalHand(cards) {
    const [c1, c2, c3] = cards;
    const vals = cards.map(c => RANK_VAL[c.rank]).sort((a, b) => b - a);
    const sameSuit = c1.suit === c2.suit && c2.suit === c3.suit;
    // Trio
    if (vals[0] === vals[1] && vals[1] === vals[2])
        return { rank: 'trio', highCard: vals[0] };
    // Straight (consecutive + handle A-2-3 wheel)
    const isConsec = (vals[0] - vals[1] === 1 && vals[1] - vals[2] === 1)
        || (vals[0] === 14 && vals[1] === 3 && vals[2] === 2); // A-2-3
    if (isConsec && sameSuit)
        return { rank: 'straight_flush', highCard: vals[0] };
    if (isConsec)
        return { rank: 'straight', highCard: vals[0] };
    if (sameSuit)
        return { rank: 'flush', highCard: vals[0] };
    // Pair
    if (vals[0] === vals[1] || vals[1] === vals[2])
        return { rank: 'pair', highCard: vals[0] };
    return { rank: 'high_card', highCard: vals[0] };
}
function compareHands(player, dealer) {
    const ph = evalHand(player);
    const dh = evalHand(dealer);
    const ps = handScore(ph.rank);
    const ds = handScore(dh.rank);
    if (ps > ds)
        return 'player';
    if (ds > ps)
        return 'dealer';
    // Same rank — compare high card
    if (ph.highCard > dh.highCard)
        return 'player';
    if (dh.highCard > ph.highCard)
        return 'dealer';
    return 'dealer'; // dealer wins ties (house edge)
}
// ─── Payout table ─────────────────────────────────────────────────────────────
const PAYOUT = {
    high_card: 1.8,
    pair: 2.0,
    flush: 3.0,
    straight: 4.0,
    straight_flush: 6.0,
    trio: 10.0,
};
// ─── Controller ───────────────────────────────────────────────────────────────
const playTeenPatti = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const bet = Number(req.body.bet);
        if (!bet || bet < MIN_BET || bet > MAX_BET) {
            res.status(400).json({ success: false, message: `Bet must be ${MIN_BET}–${MAX_BET} 💎.` });
            return;
        }
        const user = await user_model_1.User.findById(req.user.id);
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        if ((user.diamonds ?? 0) < bet) {
            res.status(400).json({ success: false, message: 'Insufficient diamonds.' });
            return;
        }
        // Deal
        const deck = secureShuffle(buildDeck());
        const [playerCards, rest] = deal(deck, 3);
        const [dealerCards] = deal(rest, 3);
        const winner = compareHands(playerCards, dealerCards);
        const ph = evalHand(playerCards);
        const payout = winner === 'player' ? Math.floor(bet * PAYOUT[ph.rank]) : 0;
        const outcome = winner === 'player' ? 'win' : winner === 'tie' ? 'tie' : 'loss';
        // Update balance
        user.diamonds -= bet;
        user.diamonds += payout;
        await user.save();
        // Persist history
        await game_history_model_1.GameHistory.create({
            userId: user._id,
            gameType: 'teen_patti',
            betAmount: bet,
            payout,
            netDelta: payout - bet,
            outcome,
            meta: { playerCards, dealerCards, playerHand: ph.rank, winner },
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
    }
    catch (err) {
        console.error('[TeenPatti]', err);
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.playTeenPatti = playTeenPatti;
const getTeenPattiConfig = (_req, res) => {
    res.json({
        success: true,
        minBet: MIN_BET,
        maxBet: MAX_BET,
        payouts: PAYOUT,
        bettingChips: [10, 25, 50, 100, 250, 500],
    });
};
exports.getTeenPattiConfig = getTeenPattiConfig;
