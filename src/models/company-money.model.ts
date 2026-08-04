import mongoose from 'mongoose';
import { ICompanyMoney } from '../types';

const companyMoneySchema = new mongoose.Schema<ICompanyMoney>({
    transactionReference: {
        type: String,
        required: true,
        unique: true
    },
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    affiliateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    },
    affiliateType: {
        type: String,
        enum: ['user', 'instructor']
    },
    amount: {
        type: Number,
        required: true
    },
    companyShare: {
        type: Number,
        required: true
    }
}, {
    timestamps: true,
    collection: 'company_money'
});

const CompanyMoney = mongoose.model('CompanyMoney', companyMoneySchema);

export default CompanyMoney;
export type { ICompanyMoney };
