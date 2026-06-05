import { Schema, model, Document, Types } from 'mongoose';

export type RegistrationRole =
  | 'super_admin'
  | 'sub_admin'
  | 'agency'
  | 'top_up_agent'
  | 'reseller'
  | 'host';

export interface IRegistrationFormData {
  fullName?: string;
  email?: string;
  phone?: string;
  idCardNumber?: string;
  region?: string;
  country?: string;
  bankName?: string;
  bankAccountNumber?: string;
  cardNumber?: string;
  agencyCode?: string;
  parentId?: string;
}

export interface IRegistrationRequest extends Document {
  role: RegistrationRole;
  status: 'pending' | 'approved' | 'rejected';
  formData: IRegistrationFormData;
  documentUrls: string[];
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;
  generatedId?: string;
  createdAt: Date;
}

const RegistrationRequestSchema = new Schema<IRegistrationRequest>(
  {
    role: {
      type: String,
      enum: ['super_admin', 'sub_admin', 'agency', 'top_up_agent', 'reseller', 'host'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    formData: {
      fullName: { type: String },
      email: { type: String },
      phone: { type: String },
      idCardNumber: { type: String },
      region: { type: String },
      country: { type: String },
      bankName: { type: String },
      bankAccountNumber: { type: String },
      cardNumber: { type: String },
      agencyCode: { type: String },
      parentId: { type: String },
    },
    documentUrls: { type: [String], default: [] },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', sparse: true },
    reviewedAt: { type: Date },
    rejectionReason: { type: String },
    generatedId: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

RegistrationRequestSchema.index({ role: 1, status: 1, createdAt: -1 });

export const RegistrationRequest = model<IRegistrationRequest>(
  'RegistrationRequest',
  RegistrationRequestSchema
);
