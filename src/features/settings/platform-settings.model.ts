import { Schema, model, Document } from 'mongoose';

export interface IPlatformSettings extends Document {
  diamondToRcoinRate: number;
  minWithdrawRcoins: number;
  minConvertDiamonds: number;
  minLevelToGoLive: number;
  dailyLoginDiamonds: number;
  referralBonusDiamonds: number;
  videoCallRcoinCost: number;
  updatedAt: Date;
}

const PlatformSettingsSchema = new Schema<IPlatformSettings>(
  {
    diamondToRcoinRate: { type: Number, default: 10 },
    minWithdrawRcoins: { type: Number, default: 100 },
    minConvertDiamonds: { type: Number, default: 10 },
    minLevelToGoLive: { type: Number, default: 1 },
    dailyLoginDiamonds: { type: Number, default: 25 },
    referralBonusDiamonds: { type: Number, default: 100 },
    videoCallRcoinCost: { type: Number, default: 5 },
  },
  { timestamps: true }
);

export const PlatformSettings = model<IPlatformSettings>(
  'PlatformSettings',
  PlatformSettingsSchema
);

export async function getPlatformSettings(): Promise<IPlatformSettings> {
  let settings = await PlatformSettings.findOne();
  if (!settings) {
    settings = await PlatformSettings.create({});
  }
  return settings;
}
