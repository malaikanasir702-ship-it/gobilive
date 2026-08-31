import { Schema, model, Document } from 'mongoose';

export interface ICountryPolicy extends Document {
  countryCode: string; // e.g. 'PK', 'IN', 'BD', 'AE', 'SA', 'GB', 'EU', 'US'
  countryName: string; // e.g. 'Pakistan', 'India'
  currency: string;    // e.g. 'PKR', 'INR', 'BDT', 'AED', 'SAR', 'GBP', 'EUR', 'USD'
  marketRate: number;  // 1 USD in local currency (market rate, e.g. 278 PKR)
  inAppRate: number;   // 1 USD in local currency (company rate, e.g. 270 PKR)
  withdrawalChargePercent: number; // e.g. 2.0 (%)
  taxPercent: number;  // e.g. 0.5 (%), 1.0 (%), 0.0 (%)
  isDefault?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CountryPolicySchema = new Schema<ICountryPolicy>(
  {
    countryCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    countryName: { type: String, required: true, trim: true },
    currency: { type: String, required: true, uppercase: true, trim: true },
    marketRate: { type: Number, required: true, min: 0 },
    inAppRate: { type: Number, required: true, min: 0 },
    withdrawalChargePercent: { type: Number, required: true, default: 2.0, min: 0 },
    taxPercent: { type: Number, required: true, default: 0.0, min: 0 },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const CountryPolicy = model<ICountryPolicy>('CountryPolicy', CountryPolicySchema);
