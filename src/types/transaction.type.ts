import mongoose from 'mongoose';

export interface ITransaction extends mongoose.Document {
    userId: mongoose.Types.ObjectId;
    courseId: mongoose.Types.ObjectId;
    amount: number;
    currency: string;
    status: 'pending' | 'successful' | 'failed' | 'cancelled';
    transactionReference: string;
    flutterwaveTransactionId?: string;
    paymentMethod: string;
    affiliateId?: mongoose.Types.ObjectId;
    affiliateType?: 'user' | 'instructor';
    createdAt: Date;
    updatedAt: Date;
}

export type CreatePaymentReqBody = {
    courseId: string;
    amount: number;
    currency?: string;
    paymentMethod?: string;
    redirectUrl?: string;
    affiliateId?: string;
}

export type CreatePaymentResT = {
    status: 'success' | 'failed';
    message: string;
    paymentLink?: string;
    transactionReference?: string;
}

export type VerifyPaymentReqQuery = {
    transaction_id: string;
    tx_ref: string;
}

export type VerifyPaymentResT = {
    status: 'success' | 'failed';
    message: string;
    transaction?: ITransaction;
}

export type FlutterwavePaymentResponse = {
    status: string;
    message: string;
    data: {
        link: string;
        redirect_url: string;
    };
}

export type FlutterwaveVerifyResponse = {
    status: string;
    message: string;
    data: {
        status: string;
        amount: number;
        currency: string;
        tx_ref: string;
        transaction_id: number;
        flw_ref: string;
        customer: {
            email: string;
            name: string;
        };
        meta: {
            authorizer: string;
        };
    };
}
