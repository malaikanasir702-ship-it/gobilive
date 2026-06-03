import { Schema, model, Document } from 'mongoose';

export interface ICoinSeller extends Document {
  userId: string;
  username: string;
  businessName: string;
  diamondsSold: number;
  totalRevenue: number;
  isApproved: boolean;
  createdAt: Date;
}

const CoinSellerSchema = new Schema<ICoinSeller>(
  {
    userId: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    businessName: { type: String, required: true },
    diamondsSold: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    isApproved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const CoinSeller = model<ICoinSeller>('CoinSeller', CoinSellerSchema);
