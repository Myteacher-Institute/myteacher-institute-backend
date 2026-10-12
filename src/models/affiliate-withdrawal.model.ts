import mongoose, { Schema, Document } from 'mongoose';

export interface IAffiliateWithdrawal extends Document {
    affiliateId: string;
    affiliateType: 'user' | 'instructor';
    amount: number;
    bankName: string;
    accountNumber: string;
    accountName: string;
    status: 'pending' | 'processing' | 'completed' | 'rejected';
    rejectionReason?: string;
    transactionReference?: string;
    processedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const AffiliateWithdrawalSchema = new Schema<IAffiliateWithdrawal>(
    {
        affiliateId: {
            type: String,
            required: true,
            index: true
        },
        affiliateType: {
            type: String,
            enum: ['user', 'instructor'],
            required: true
        },
        amount: {
            type: Number,
            required: true,
            min: 1000 // Minimum withdrawal amount
        },
        bankName: {
            type: String,
            required: true
        },
        accountNumber: {
            type: String,
            required: true
        },
        accountName: {
            type: String,
            required: true
        },
        status: {
            type: String,
            enum: ['pending', 'processing', 'completed', 'rejected'],
            default: 'pending'
        },
        rejectionReason: {
            type: String
        },
        transactionReference: {
            type: String
        },
        processedAt: {
            type: Date
        }
    },
    {
        timestamps: true
    }
);

// Compound index for efficient queries
AffiliateWithdrawalSchema.index({ affiliateId: 1, status: 1 });
AffiliateWithdrawalSchema.index({ affiliateId: 1, createdAt: -1 });

export const AffiliateWithdrawal = mongoose.model<IAffiliateWithdrawal>('AffiliateWithdrawal', AffiliateWithdrawalSchema);
