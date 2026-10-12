import mongoose, { Schema, Document } from 'mongoose';

export interface IAffiliateReferral extends Document {
    affiliateId: string;
    affiliateType: 'user' | 'instructor';
    referredUserId?: string;
    courseId?: string;
    referredEmail?: string;
    referralLink: string;
    status: 'pending' | 'signup' | 'enrolled' | 'completed';
    earnings: number;
    commission: number;
    createdAt: Date;
    updatedAt: Date;
}

const AffiliateReferralSchema = new Schema<IAffiliateReferral>(
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
        referredUserId: {
            type: String,
            index: true
        },
        courseId: {
            type: String,
            index: true
        },
        referredEmail: {
            type: String
        },
        referralLink: {
            type: String,
            required: true
        },
        status: {
            type: String,
            enum: ['pending', 'signup', 'enrolled', 'completed'],
            default: 'pending'
        },
        earnings: {
            type: Number,
            default: 0
        },
        commission: {
            type: Number,
            default: 0.20 // 20% commission
        }
    },
    {
        timestamps: true
    }
);

// Compound index for efficient queries
AffiliateReferralSchema.index({ affiliateId: 1, status: 1 });
AffiliateReferralSchema.index({ affiliateId: 1, createdAt: -1 });

export const AffiliateReferral = mongoose.model<IAffiliateReferral>('AffiliateReferral', AffiliateReferralSchema);
