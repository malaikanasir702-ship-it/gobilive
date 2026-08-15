"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const WalletTransactionSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
        type: String,
        enum: [
            'purchase_diamonds',
            'convert_diamonds_to_rcoins',
            'convert_beans_to_diamonds',
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
    currency: { type: String, enum: ['diamonds', 'rcoins', 'beans', 'usd'], required: true },
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
    metadata: { type: mongoose_1.Schema.Types.Mixed },
    transferSlipUrl: { type: String },
}, { timestamps: true });
WalletTransactionSchema.index({ userId: 1, createdAt: -1 });
exports.default = mongoose_1.default.model('WalletTransaction', WalletTransactionSchema);
