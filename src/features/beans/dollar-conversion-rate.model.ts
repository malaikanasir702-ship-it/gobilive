import { Schema, model, Document } from 'mongoose';

export interface IDollarConversionRate extends Document {
  countryCode: string;
  countryName: string;
  rate: number;
  updatedAt: Date;
}

const DollarConversionRateSchema = new Schema<IDollarConversionRate>(
  {
    countryCode: { type: String, required: true, unique: true, uppercase: true },
    countryName: { type: String, required: true },
    rate: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

export const DollarConversionRate = model<IDollarConversionRate>(
  'DollarConversionRate',
  DollarConversionRateSchema
);
