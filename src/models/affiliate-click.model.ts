import mongoose, { Schema, Document } from 'mongoose';

export interface IAffiliateClick extends Document {
    affiliateId: string;
    affiliateType: 'user' | 'instructor';
    referralLink: string;
    courseId?: string;
    ipAddress?: string;
    userAgent?: string;
    createdAt: Date;
}

const AffiliateClickSchema = new Schema<IAffiliateClick>(
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
        referralLink: {
            type: String,
            required: true
        },
        courseId: {
            type: String,
            index: true
        },
        ipAddress: {
            type: String
        },
        userAgent: {
            type: String
        }
    },
    {
        timestamps: { createdAt: true, updatedAt: false }
    }
);

// Compound index for efficient queries
AffiliateClickSchema.index({ affiliateId: 1, createdAt: -1 });
AffiliateClickSchema.index({ referralLink: 1, createdAt: -1 });

export const AffiliateClick = mongoose.model<IAffiliateClick>('AffiliateClick', AffiliateClickSchema);
