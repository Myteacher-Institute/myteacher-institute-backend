import mongoose, { Schema } from "mongoose";

export interface IAITokenPurchase {
  userId: mongoose.Types.ObjectId;
  tokens: number;
  bonusTokens: number;
  totalTokens: number;
  amountNgn: number;
  transactionReference: string;
  flutterwaveTransactionId?: string;
  status: 'pending' | 'successful' | 'failed' | 'cancelled';
  paymentMethod: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const aiTokenPurchaseSchema = new Schema<IAITokenPurchase>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  tokens: {
    type: Number,
    required: true
  },
  bonusTokens: {
    type: Number,
    default: 0
  },
  totalTokens: {
    type: Number,
    required: true
  },
  amountNgn: {
    type: Number,
    required: true
  },
  transactionReference: {
    type: String,
    required: true,
    unique: true
  },
  flutterwaveTransactionId: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'successful', 'failed', 'cancelled'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    default: 'flutterwave'
  },
  paidAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
aiTokenPurchaseSchema.index({ userId: 1, createdAt: -1 });
aiTokenPurchaseSchema.index({ transactionReference: 1 });
aiTokenPurchaseSchema.index({ status: 1 });

const AITokenPurchase = mongoose.model<IAITokenPurchase>('AITokenPurchase', aiTokenPurchaseSchema);

export default AITokenPurchase;