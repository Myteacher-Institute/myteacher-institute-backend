import mongoose from "mongoose";

export interface IAffiliate extends mongoose.Document {
    userId: mongoose.Types.ObjectId;
    userType: 'user' | 'instructor';
    affiliate_id: string;
    isActive: boolean;
    affiliate_money: number;
    totalEarnings: number;
    totalClicks: number;
    totalConversions: number;
    createdAt: Date;
    updatedAt: Date;
}

export type ActivateAffiliateReqBody = {
    userId: string;
    userType: 'user' | 'instructor';
}

export type ActivateAffiliateResT = {
    status: "success" | "failed",
    message: string,
    affiliate?: {
        affiliate_id: string;
        isActive: boolean;
    }
}

export type GenerateAffiliateLinkReqBody = {
    courseId: string;
    userId: string;
    userType: 'user' | 'instructor';
}

export type GenerateAffiliateLinkResT = {
    status: "success" | "failed",
    message: string,
    affiliateLink?: string;
}

export type GetAffiliateStatsReqBody = {
    userId: string;
    userType: 'user' | 'instructor';
}

export type GetAffiliateStatsResT = {
    status: "success" | "failed",
    message: string,
    stats?: {
        affiliate_id: string;
        isActive: boolean;
        affiliate_money: number;
        totalEarnings: number;
        totalClicks: number;
        totalConversions: number;
    }
}
