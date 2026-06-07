import mongoose, { Schema, Document } from 'mongoose';

export type GameType = 'spin' | 'teen_patti' | 'dice' | 'plinko';
export type GameOutcome = 'win' | 'loss' | 'tie';

export interface IGameHistory extends Document {
  userId: mongoose.Types.ObjectId;
  gameType: GameType;
  betAmount: number;
  payout: number;        // diamonds actually won (0 if loss)
  netDelta: number;      // payout - betAmount
  outcome: GameOutcome;
  meta: Record<string, unknown>; // game-specific data (cards, dice values, path etc.)
  diamondsAfter: number;
  createdAt: Date;
}

const GameHistorySchema = new Schema<IGameHistory>(
  {
    userId:        { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    gameType:      { type: String, enum: ['spin', 'teen_patti', 'dice', 'plinko'], required: true },
    betAmount:     { type: Number, required: true },
    payout:        { type: Number, required: true, default: 0 },
    netDelta:      { type: Number, required: true, default: 0 },
    outcome:       { type: String, enum: ['win', 'loss', 'tie'], required: true },
    meta:          { type: Schema.Types.Mixed, default: {} },
    diamondsAfter: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

GameHistorySchema.index({ userId: 1, createdAt: -1 });
GameHistorySchema.index({ gameType: 1, createdAt: -1 });

export const GameHistory = mongoose.model<IGameHistory>('GameHistory', GameHistorySchema);
