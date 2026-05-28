import { Request, Response } from 'express';
import Transaction from '../models/transaction.model';
import User from '../models/user.model';
import { Course } from '../models/course.model';
import { createPaymentLink, verifyTransaction, generateTransactionReference } from '../services';
import { CreatePaymentReqBody, CreatePaymentResT, VerifyPaymentResT } from '../types';

/**
 * Create a payment link for course purchase
 */
export const handleCreatePayment = async (req: Request<{}, {}, CreatePaymentReqBody>, res: Response<CreatePaymentResT>) => {
    try {
        const userId = req.userId;
        const { courseId, amount, currency = 'NGN', paymentMethod = 'flutterwave', redirectUrl } = req.body;

        // Validate request
        if (!userId) {
            return res.status(401).json({
                status: 'failed',
                message: 'Unauthorized: User ID not found'
            });
        }

        if (!courseId || !amount) {
            return res.status(400).json({
                status: 'failed',
                message: 'Course ID and amount are required'
            });
        }

        // Check if course exists
        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({
                status: 'failed',
                message: 'Course not found'
            });
        }

        // Check if user already bought this course
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                status: 'failed',
                message: 'User not found'
            });
        }

        if (user.coursesBought && user.coursesBought.some(boughtCourseId => boughtCourseId.toString() === courseId)) {
            return res.status(400).json({
                status: 'failed',
                message: 'You have already purchased this course'
            });
        }

        // Generate transaction reference
        const transactionReference = generateTransactionReference(userId, courseId);

        // Create pending transaction
        const transaction = await Transaction.create({
            userId,
            courseId,
            amount,
            currency,
            status: 'pending',
            transactionReference,
            paymentMethod
        });

        // Create Flutterwave payment link
        const paymentResponse = await createPaymentLink({
            amount,
            currency,
            tx_ref: transactionReference,
            redirect_url: redirectUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/callback`,
            customer: {
                email: user.email,
                name: user.name
            },
            customizations: {
                title: `Purchase: ${course.courseName}`,
                description: course.description
            }
        });

        return res.status(200).json({
            status: 'success',
            message: 'Payment link created successfully',
            paymentLink: paymentResponse.data.link,
            transactionReference
        });

    } catch (error) {
        console.error('Create payment error:', error);
        res.status(500).json({
            status: 'failed',
            message: 'Internal server error'
        });
    }
};

/**
 * Verify payment and complete transaction
 */
export const handleVerifyPayment = async (req: Request<{}, {}, {}, { transaction_id: string; tx_ref: string }>, res: Response<VerifyPaymentResT>) => {
    try {
        const { transaction_id, tx_ref } = req.query;

        if (!transaction_id || !tx_ref) {
            return res.status(400).json({
                status: 'failed',
                message: 'Transaction ID and reference are required'
            });
        }

        // Find transaction by reference
        const transaction = await Transaction.findOne({ transactionReference: tx_ref });
        if (!transaction) {
            return res.status(404).json({
                status: 'failed',
                message: 'Transaction not found'
            });
        }

        // If already successful, return existing transaction
        if (transaction.status === 'successful') {
            return res.status(200).json({
                status: 'success',
                message: 'Transaction already verified',
                transaction
            });
        }

        // Verify with Flutterwave
        const verificationResponse = await verifyTransaction(transaction_id);

        // Check if payment was successful
        if (verificationResponse.data.status !== 'successful') {
            // Update transaction status to failed
            transaction.status = 'failed';
            transaction.flutterwaveTransactionId = transaction_id;
            await transaction.save();

            return res.status(400).json({
                status: 'failed',
                message: 'Payment was not successful',
                transaction
            });
        }

        // Update transaction status
        transaction.status = 'successful';
        transaction.flutterwaveTransactionId = transaction_id;
        await transaction.save();

        // Add course to user's purchased courses
        const user = await User.findById(transaction.userId);
        if (user) {
            if (!user.coursesBought) {
                user.coursesBought = [];
            }
            
            // Check if course is not already in the list
            if (!user.coursesBought.some(boughtCourseId => boughtCourseId.toString() === transaction.courseId.toString())) {
                user.coursesBought.push(transaction.courseId as any);
                await user.save();
            }
        }

        return res.status(200).json({
            status: 'success',
            message: 'Payment verified successfully',
            transaction
        });

    } catch (error) {
        console.error('Verify payment error:', error);
        res.status(500).json({
            status: 'failed',
            message: 'Internal server error'
        });
    }
};

/**
 * Get user's transaction history
 */
export const handleGetUserTransactions = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({
                status: 'failed',
                message: 'Unauthorized: User ID not found'
            });
        }

        const transactions = await Transaction.find({ userId })
            .populate('courseId', 'courseName description price')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            status: 'success',
            message: 'Transactions retrieved successfully',
            transactions
        });

    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({
            status: 'failed',
            message: 'Internal server error'
        });
    }
};

/**
 * Get transaction by reference
 */
export const handleGetTransactionByRef = async (req: Request<{ tx_ref: string }>, res: Response) => {
    try {
        const { tx_ref } = req.params;

        const transaction = await Transaction.findOne({ transactionReference: tx_ref })
            .populate('courseId', 'courseName description price')
            .populate('userId', 'name email');

        if (!transaction) {
            return res.status(404).json({
                status: 'failed',
                message: 'Transaction not found'
            });
        }

        return res.status(200).json({
            status: 'success',
            message: 'Transaction retrieved successfully',
            transaction
        });

    } catch (error) {
        console.error('Get transaction error:', error);
        res.status(500).json({
            status: 'failed',
            message: 'Internal server error'
        });
    }
};
