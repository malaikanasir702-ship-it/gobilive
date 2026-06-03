import { Schema, model, Document } from 'mongoose';

export interface ICoinSellerSale extends Document {
  sellerId: string;
  sellerUsername: string;
  diamonds: number;
  revenueUsd: number;
  createdAt: Date;
}

const CoinSellerSaleSchema = new Schema<ICoinSellerSale>(
  {
    sellerId: { type: String, required: true, index: true },
    sellerUsername: { type: String, required: true },
    diamonds: { type: Number, required: true },
    revenueUsd: { type: Number, required: true },
  },
  { timestamps: true }
);

export const CoinSellerSale = model<ICoinSellerSale>('CoinSellerSale', CoinSellerSaleSchema);
export default CoinSellerSale;
