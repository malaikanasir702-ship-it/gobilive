import mongoose, { Schema, Document } from 'mongoose';

export type WalletCurrency = 'diamonds' | 'rcoins' | 'usd';
export type WalletTxType =
  | 'purchase_diamonds'
  | 'convert_diamonds_to_rcoins'
  | 'withdraw_rcoins'
  | 'vip_purchase'
  | 'gift_spend'
  | 'gift_earn'
  | 'admin_adjust'
  | 'referral_bonus'
  | 'daily_reward'
  | 'ad_reward'
  | 'video_call_spend'
  | 'video_call_earn'
  | 'bean_assign'
  | 'bean_transfer'
  | 'bean_request'
  | 'bean_generate';

export type WalletTxStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

export interface IWalletTransaction extends Document {
  userId: mongoose.Types.ObjectId;
  type: WalletTxType;
  currency: WalletCurrency;
  amount: number;
  diamondsDelta: number;
  rcoinsDelta: number;
  diamondsBalance: number;
  rcoinsBalance: number;
  status: WalletTxStatus;
  stripePaymentIntentId?: string;
  description: string;
  metadata?: Record<string, unknown>;
  transferSlipUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WalletTransactionSchema = new Schema<IWalletTransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: [
        'purchase_diamonds',
        'convert_diamonds_to_rcoins',
        'withdraw_rcoins',
        'vip_purchase',
        'gift_spend',
        'gift_earn',
        'admin_adjust',
        'referral_bonus',
        'daily_reward',
        'ad_reward',
        'video_call_spend',
        'video_call_earn',
        'bean_assign',
        'bean_transfer',
        'bean_request',
        'bean_generate',
      ],
      required: true,
    },
    currency: { type: String, enum: ['diamonds', 'rcoins', 'usd'], required: true },
    amount: { type: Number, required: true },
    diamondsDelta: { type: Number, default: 0 },
    rcoinsDelta: { type: Number, default: 0 },
    diamondsBalance: { type: Number, required: true },
    rcoinsBalance: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'cancelled'],
      default: 'pending',
    },
    stripePaymentIntentId: { type: String, index: true, sparse: true },
    description: { type: String, default: '' },
    metadata: { type: Schema.Types.Mixed },
    transferSlipUrl: { type: String },
  },
  { timestamps: true }
);

WalletTransactionSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<IWalletTransaction>(
  'WalletTransaction',
  WalletTransactionSchema
);
