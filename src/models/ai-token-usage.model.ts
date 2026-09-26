import mongoose, { Schema } from "mongoose";

export interface IAITokenUsage {
  userId: mongoose.Types.ObjectId;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
  openaiCostUsd: number;
  platformFeeUsd: number;
  totalCostUsd: number;
  totalCostNgn: number;
  tokensDeducted: number;
  requestType: 'chat' | 'code_analysis' | 'file_analysis' | 'voice' | 'other';
  status: 'success' | 'failed' | 'pending';
  errorMessage?: string;
  createdAt: Date;
}

const aiTokenUsageSchema = new Schema<IAITokenUsage>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  model: {
    type: String,
    required: true
  },
  inputTokens: {
    type: Number,
    required: true
  },
  outputTokens: {
    type: Number,
    required: true
  },
  totalTokens: {
    type: Number,
    required: true
  },
  cachedTokens: {
    type: Number,
    default: 0
  },
  cacheWriteTokens: {
    type: Number,
    default: 0
  },
  reasoningTokens: {
    type: Number,
    default: 0
  },
  openaiCostUsd: {
    type: Number,
    required: true
  },
  platformFeeUsd: {
    type: Number,
    required: true
  },
  totalCostUsd: {
    type: Number,
    required: true
  },
  totalCostNgn: {
    type: Number,
    required: true
  },
  tokensDeducted: {
    type: Number,
    required: true
  },
  requestType: {
    type: String,
    enum: ['chat', 'code_analysis', 'file_analysis', 'voice', 'other'],
    default: 'chat'
  },
  status: {
    type: String,
    enum: ['success', 'failed', 'pending'],
    default: 'pending'
  },
  errorMessage: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
aiTokenUsageSchema.index({ userId: 1, createdAt: -1 });
aiTokenUsageSchema.index({ userId: 1, status: 1 });
aiTokenUsageSchema.index({ createdAt: -1 });

const AITokenUsage = mongoose.model<IAITokenUsage>('AITokenUsage', aiTokenUsageSchema);

export default AITokenUsage;