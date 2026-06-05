import { Schema, model, Document } from 'mongoose';

export interface IGameConfig extends Document {
  gameId: string;
  name: string;
  enabled: boolean;
  meta?: Record<string, any>;
  createdAt: Date;
}

const GameConfigSchema = new Schema<IGameConfig>(
  {
    gameId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const GameConfig = model<IGameConfig>('GameConfig', GameConfigSchema);
