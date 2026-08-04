import mongoose from 'mongoose';

export interface ICompanyMoney extends mongoose.Document {
    transactionReference: string;
    courseId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    affiliateId?: mongoose.Types.ObjectId;
    affiliateType?: 'user' | 'instructor';
    amount: number;
    companyShare: number;
    createdAt: Date;
    updatedAt: Date;
}
