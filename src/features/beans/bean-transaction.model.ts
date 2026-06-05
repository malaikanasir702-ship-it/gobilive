import { Schema, model, Document, Types } from 'mongoose';

export type BeanTxType = 'generate' | 'assign' | 'transfer' | 'request' | 'receive';

export interface IBeanTransaction extends Document {
  type: BeanTxType;
  fromId?: Types.ObjectId;
  fromRole?: string;
  toId: Types.ObjectId;
  toRole: string;
  amount: number;
  transferSlipUrl?: string;
  status: 'pending' | 'completed' | 'rejected';
  note?: string;
  createdAt: Date;
}

const BeanTransactionSchema = new Schema<IBeanTransaction>(
  {
    type: {
      type: String,
      enum: ['generate', 'assign', 'transfer', 'request', 'receive'],
      required: true,
    },
    fromId: { type: Schema.Types.ObjectId, ref: 'User', sparse: true },
    fromRole: { type: String },
    toId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    toRole: { type: String, required: true },
    amount: { type: Number, required: true, min: 1 },
    transferSlipUrl: { type: String },
    status: {
      type: String,
      enum: ['pending', 'completed', 'rejected'],
      default: 'pending',
    },
    note: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

BeanTransactionSchema.index({ fromId: 1, createdAt: -1 });
BeanTransactionSchema.index({ toId: 1, createdAt: -1 });
BeanTransactionSchema.index({ type: 1, status: 1 });

export const BeanTransaction = model<IBeanTransaction>('BeanTransaction', BeanTransactionSchema);
