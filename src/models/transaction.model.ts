import mongoose from 'mongoose';
import { ITransaction } from '../types';

const transactionSchema = new mongoose.Schema<ITransaction>({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    // Optional since a transaction may also be for a mentorship payment
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course'
    },
    purpose: {
        type: String,
        enum: ['course', 'mentorship'],
        default: 'course',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'NGN',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'successful', 'failed', 'cancelled'],
        default: 'pending',
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
    paymentMethod: {
        type: String,
        default: 'flutterwave',
        required: true
    },
    affiliateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    },
    affiliateType: {
        type: String,
        enum: ['user', 'instructor']
    }
}, {
    timestamps: true
});

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;
export type { ITransaction };
