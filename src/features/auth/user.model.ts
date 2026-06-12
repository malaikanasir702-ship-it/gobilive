import { Schema, model, Document } from 'mongoose';

export interface INotificationPrefs {
  messages: boolean;
  calls: boolean;
  gifts: boolean;
  follows: boolean;
  liveAlerts: boolean;
}

export type UserRole =
  | 'user'
  | 'agency'
  | 'coin_seller'
  | 'admin'
  | 'company_admin'
  | 'super_admin'
  | 'sub_admin'
  | 'sub_agency'
  | 'top_up_agent'
  | 'reseller';

export interface IUser extends Document {
  username: string;
  email?: string;
  phone?: string;
  passwordHash: string;
  googleId?: string;
  appleId?: string;
  authProvider: 'local' | 'google' | 'apple';
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  twoFactorPendingSecret?: string;
  bio: string;
  profilePic: string;
  age?: number;
  gender?: string;
  level: number;
  xp: number;
  diamonds: number;
  rcoins: number;
  isVIP: boolean;
  vipFrame: string;
  vipExpiresAt?: Date;
  badges: string[];
  stripeCustomerId?: string;
  payoutMethod: string;
  payoutDetails: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  fcmTokens: string[];
  fcmPlatform?: string;
  followersCount: number;
  followingCount: number;
  likesCount: number;
  referralCode: string;
  referredBy?: string;
  lastDailyRewardAt?: Date;
  lastFreeSpinAt?: Date;
  notificationPrefs: INotificationPrefs;
  blockedUsers: string[];
  searchHistory: string[];
  hiddenCreators: string[];
  isSuspended: boolean;
  tokenVersion: number;
  role: UserRole;
  agencyId?: string;
  thought?: string;
  thoughtUpdatedAt?: Date;
  createdAt: Date;
  // Admin panel extensions
  beanWallet: number;
  isBlocked: boolean;
  blockedUntil?: Date;
  blockType?: 'permanent' | 'temporary';
  isTerminated: boolean;
  parentId?: Schema.Types.ObjectId;
  // Identity / KYC fields (for admin roles)
  idCardNumber?: string;
  idCardDocUrl?: string;
  faceVerificationUrl?: string;
  region?: string;
  country?: string;
  cardNumber?: string;
  // Share & commission
  sharePercent?: number;
  // Privacy
  isPrivate: boolean;
}

const UserSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  phone: { type: String, unique: true, sparse: true, trim: true },
  passwordHash: { type: String, required: true },
  googleId: { type: String, unique: true, sparse: true },
  appleId: { type: String, unique: true, sparse: true },
  authProvider: { type: String, enum: ['local', 'google', 'apple'], default: 'local' },
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String },
  twoFactorPendingSecret: { type: String },
  bio: { type: String, default: 'Hello, I am using Gobilive!' },
  profilePic: { type: String, default: '' },
  level: { type: Number, default: 1 },
  diamonds: { type: Number, default: 1000 },
  rcoins: { type: Number, default: 0 },
  isVIP: { type: Boolean, default: false },
  vipFrame: { type: String, default: '' },
  vipExpiresAt: { type: Date },
  badges: { type: [String], default: [] },
  stripeCustomerId: { type: String },
  payoutMethod: { type: String, default: 'bank' },
  payoutDetails: { type: String, default: '' },
  bankName: { type: String, default: '' },
  bankAccountNumber: { type: String, default: '' },
  bankAccountHolder: { type: String, default: '' },
  fcmTokens: { type: [String], default: [] },
  fcmPlatform: { type: String },
  age: { type: Number },
  gender: { type: String, default: '' },
  xp: { type: Number, default: 0 },
  followersCount: { type: Number, default: 0 },
  followingCount: { type: Number, default: 0 },
  likesCount: { type: Number, default: 0 },
  referralCode: { type: String, unique: true, sparse: true },
  referredBy: { type: String },
  lastDailyRewardAt: { type: Date },
  lastFreeSpinAt: { type: Date },
  notificationPrefs: {
    type: {
      messages: { type: Boolean, default: true },
      calls: { type: Boolean, default: true },
      gifts: { type: Boolean, default: true },
      follows: { type: Boolean, default: true },
      liveAlerts: { type: Boolean, default: true },
    },
    default: () => ({
      messages: true,
      calls: true,
      gifts: true,
      follows: true,
      liveAlerts: true,
    }),
  },
  blockedUsers: { type: [String], default: [] },
  searchHistory: { type: [String], default: [] },
  hiddenCreators: { type: [String], default: [] },
  isSuspended: { type: Boolean, default: false },
  tokenVersion: { type: Number, default: 0 },
  role: {
    type: String,
    enum: ['user', 'agency', 'coin_seller', 'admin', 'company_admin', 'super_admin', 'sub_admin', 'sub_agency', 'top_up_agent', 'reseller'],
    default: 'user',
  },
  agencyId: { type: String },
  thought: { type: String, default: '' },
  thoughtUpdatedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  // Admin panel extensions
  beanWallet: { type: Number, default: 0 },
  isBlocked: { type: Boolean, default: false },
  blockedUntil: { type: Date },
  blockType: { type: String, enum: ['permanent', 'temporary'], sparse: true },
  isTerminated: { type: Boolean, default: false },
  parentId: { type: Schema.Types.ObjectId, ref: 'User', sparse: true },
  // Identity / KYC
  idCardNumber: { type: String },
  idCardDocUrl: { type: String },
  faceVerificationUrl: { type: String },
  region: { type: String },
  country: { type: String },
  cardNumber: { type: String },
  // Share
  sharePercent: { type: Number },
  // Privacy
  isPrivate: { type: Boolean, default: false },
});

UserSchema.pre('save', function () {
  if (!this.referralCode) {
    this.referralCode = `GB${this.username.slice(0, 4).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }
});

export const User = model<IUser>('User', UserSchema);
