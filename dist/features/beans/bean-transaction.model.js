"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BeanTransaction = void 0;
const mongoose_1 = require("mongoose");
const BeanTransactionSchema = new mongoose_1.Schema({
    type: {
        type: String,
        enum: ['generate', 'assign', 'transfer', 'request', 'receive'],
        required: true,
    },
    fromId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', sparse: true },
    fromRole: { type: String },
    toId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    toRole: { type: String, required: true },
    amount: { type: Number, required: true, min: 1 },
    transferSlipUrl: { type: String },
    status: {
        type: String,
        enum: ['pending', 'completed', 'rejected'],
        default: 'pending',
    },
    note: { type: String },
}, { timestamps: { createdAt: true, updatedAt: false } });
BeanTransactionSchema.index({ fromId: 1, createdAt: -1 });
BeanTransactionSchema.index({ toId: 1, createdAt: -1 });
BeanTransactionSchema.index({ type: 1, status: 1 });
exports.BeanTransaction = (0, mongoose_1.model)('BeanTransaction', BeanTransactionSchema);
