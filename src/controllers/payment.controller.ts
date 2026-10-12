import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Transaction from '../models/transaction.model';
import User from '../models/user.model';
import { Instructor } from '../models/instructor.model';
import { Admin } from '../models/admin.model';
import CompanyMoney from '../models/company-money.model';
import { Course } from '../models/course.model';
import { createPaymentLink, verifyTransaction, verifyTransactionByReference, generateTransactionReference } from '../services';
import { CreatePaymentReqBody, CreatePaymentResT, VerifyPaymentResT } from '../types';
import { FlutterwaveVerifyResponse } from '../types/transaction.type';
import { sanitizeRedirectUrl } from '../utils';
import { emitToUser } from '../config/socket';
import { invalidateInstructorStudentsCache } from '../services/instructor-students.service';
import { invalidateInstructorEarningsCache } from '../services/instructor-earnings.service';
import { createNotification } from '../services/notification.service';
import { sendCoursePurchaseEmail } from '../services/email.service';
import { completeSuccessfulMentorship } from '../services/mentor.service';
import { cacheDelPattern } from '../config/redis';
import { trackAffiliateEnrollment, processAffiliateEarnings } from '../services/affiliate-tracking.service';

const ALLOWED_REDIRECT_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000'];

/**
 * Resolve a shared affiliate code (e.g. "AB12CD34ef5678ab") to the owner's
 * document id + model type. Returns null when the code is unknown or when the
 * owner would be "referring" themselves (buyer = affiliate, or the affiliate
 * is the course's own instructor).
 */
const resolveAffiliate = async (affiliateId: string, buyerUserId: string, course: any) => {
    const affiliateUser = await User.findOne({ affiliate_id: affiliateId }).select('_id').lean();
    if (affiliateUser) {
        if (affiliateUser._id.toString() === buyerUserId) return null;
        return { affiliateId: affiliateUser._id, affiliateType: 'user' as const };
    }

    const affiliateInstructor = await Instructor.findOne({ affiliate_id: affiliateId }).select('_id').lean();
    if (affiliateInstructor) {
        if (course?.instructorDetails?.userId?.toString() === affiliateInstructor._id.toString()) return null;
        return { affiliateId: affiliateInstructor._id, affiliateType: 'instructor' as const };
    }

    return null;
};

/**
 * Create a payment link for course purchase
 */
export const handleCreatePayment = async (req: Request<{}, {}, CreatePaymentReqBody>, res: Response<CreatePaymentResT>) => {
    try {
        const userId = req.userId;
        const { courseId, amount, currency = 'NGN', paymentMethod = 'flutterwave', redirectUrl, affiliateId } = req.body;

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

        // #21 Validate redirect URL — reject URLs pointing outside allowed origins
        const safeRedirectUrl = redirectUrl
            ? sanitizeRedirectUrl(redirectUrl, ALLOWED_REDIRECT_ORIGINS)
            : `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/callback`;

        if (redirectUrl && !safeRedirectUrl) {
            return res.status(400).json({
                status: 'failed',
                message: 'Invalid redirect URL'
            });
        }

        // Generate transaction reference
        const transactionReference = generateTransactionReference(userId, courseId);

        // Resolve the affiliate (if any) behind a shared referral link. The
        // affiliate code is recorded on the transaction so the revenue split
        // happens once at verification time.
        let affiliate: { affiliateId: mongoose.Types.ObjectId; affiliateType: 'user' | 'instructor' } | null = null;
        if (affiliateId) {
            try {
                affiliate = await resolveAffiliate(affiliateId, userId, course);
            } catch (affiliateError) {
                console.error('Affiliate resolution error:', affiliateError);
                affiliate = null;
            }
        }

        // Create pending transaction
        const transaction = await Transaction.create({
            userId,
            courseId,
            amount,
            currency,
            status: 'pending',
            transactionReference,
            paymentMethod,
            affiliateId: affiliate?.affiliateId,
            affiliateType: affiliate?.affiliateType
        });

        // Create Flutterwave payment link
        const paymentResponse = await createPaymentLink({
            amount,
            currency,
            tx_ref: transactionReference,
            redirect_url: safeRedirectUrl!,
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
 * Complete a successfully verified purchase: mark the transaction successful,
 * grant the course to the buyer, add them to appliedUsers, notify the
 * instructor (socket + cache invalidation) and notify/email the buyer.
 */
const completeSuccessfulPurchase = async (transaction: any, request: Request) => {
    transaction.status = 'successful';
    await transaction.save();

    const user = await User.findById(transaction.userId);
    if (!user) return;

    if (!user.coursesBought) {
        user.coursesBought = [];
    }

    const course = await Course.findById(transaction.courseId);

    const alreadyBought = user.coursesBought.some(
        (boughtCourseId) => boughtCourseId.toString() === transaction.courseId.toString()
    );

    if (!alreadyBought) {
        user.coursesBought.push(transaction.courseId as any);
        await user.save();

        if (course) {
            const clientIp = request.ip || request.socket.remoteAddress || 'unknown';

            // Check if user is not already in appliedUsers
            const isAlreadyApplied = course.appliedUsers?.some(
                (appliedUser: any) => appliedUser.userId.toString() === user._id.toString()
            );

            if (!isAlreadyApplied) {
                course.appliedUsers = course.appliedUsers || [];
                course.appliedUsers.push({
                    userId: user._id,
                    userName: user.name,
                    userEmail: user.email,
                    ipAddress: clientIp,
                    appliedAt: new Date()
                });
                await course.save();

                // Emit real-time update to instructor
                if (course.instructorDetails?.userId) {
                    emitToUser(course.instructorDetails.userId.toString(), 'student:enrolled', {
                        courseId: course._id,
                        courseName: course.courseName,
                        student: {
                            userId: user._id,
                            userName: user.name,
                            userEmail: user.email,
                            appliedAt: new Date()
                        }
                    });

                    // Emit earnings update to instructor
                    emitToUser(course.instructorDetails.userId.toString(), 'earnings:updated', {
                        courseId: course._id,
                        courseName: course.courseName,
                        newStudent: {
                            userId: user._id,
                            userName: user.name,
                            userEmail: user.email
                        },
                        coursePrice: course.price
                    });

                    // Invalidate cache for this instructor
                    await invalidateInstructorStudentsCache(course.instructorDetails.userId.toString());
                    await invalidateInstructorEarningsCache(course.instructorDetails.userId.toString());
                }
            }

            // Invalidate the buyer's course cache so the dashboard and learn
            // page pick up the new enrollment immediately.
            try {
                await cacheDelPattern(`user:${user._id.toString()}:courses`);
            } catch (cacheError) {
                console.error('Failed to invalidate user courses cache:', cacheError);
            }
        }

        // #24 Revenue split — 70/30 (instructor/company) by default, or
        // 50/30/20 (instructor/company/affiliate) when the sale was referred.
        if (course) {
            try {
                const instructorId = course.instructorDetails?.userId;
                if (instructorId) {
                    const hasAffiliate = transaction.affiliateId && transaction.affiliateType;
                    let instructorShare = 0;
                    let affiliateShare = 0;

                    if (hasAffiliate) {
                        const affiliateOwnsCourse =
                            transaction.affiliateType === 'instructor' &&
                            instructorId.toString() === transaction.affiliateId.toString();
                        const affiliateIsBuyer =
                            transaction.affiliateType === 'user' &&
                            transaction.affiliateId.toString() === user._id.toString();

                        if (!affiliateOwnsCourse && !affiliateIsBuyer) {
                            affiliateShare = transaction.amount * 0.2;
                            instructorShare = transaction.amount * 0.5;

                            // Track affiliate enrollment
                            await trackAffiliateEnrollment(
                                transaction.affiliateId.toString(),
                                transaction.affiliateType,
                                user._id.toString(),
                                course._id.toString(),
                                transaction.amount,
                                `${process.env.FRONTEND_URL || 'http://localhost:3000'}/course/${course._id}?affiliate=${transaction.affiliateId}`
                            );

                            // Process affiliate earnings immediately
                            await processAffiliateEarnings(
                                transaction.affiliateId.toString(),
                                transaction.affiliateType,
                                user._id.toString(),
                                course._id.toString(),
                                transaction.amount
                            );

                            if (transaction.affiliateType === 'instructor') {
                                await Instructor.findByIdAndUpdate(transaction.affiliateId, {
                                    $inc: { affiliate_money: affiliateShare }
                                });
                            } else {
                                await User.findByIdAndUpdate(transaction.affiliateId, {
                                    $inc: { affiliate_money: affiliateShare }
                                });
                            }
                        }
                    }

                    if (instructorShare === 0) {
                        instructorShare = transaction.amount * 0.7;
                    }

                    await Instructor.findByIdAndUpdate(instructorId, {
                        $inc: { moneyMade: instructorShare }
                    });

                    // #25 Company share — 30% of every course sale is recorded
                    // in the CompanyMoney model (one entry per transaction).
                    const companyShare = transaction.amount * 0.3;
                    await CompanyMoney.create({
                        transactionReference: transaction.transactionReference,
                        courseId: transaction.courseId,
                        userId: transaction.userId,
                        affiliateId: transaction.affiliateId,
                        affiliateType: transaction.affiliateType,
                        amount: transaction.amount,
                        companyShare
                    });
                }
            } catch (splitError) {
                console.error('Revenue split error:', splitError);
            }
        }
    }

    // Notify the buyer and send a purchase confirmation email.
    if (course) {
        try {
            await createNotification({
                recipientId: user._id.toString(),
                recipientType: 'user',
                title: 'Course purchased',
                message: `You have successfully enrolled in "${course.courseName}". You can start learning now!`,
                type: 'success',
                relatedId: course._id.toString(),
                relatedType: 'course',
            });
        } catch (notifyError) {
            console.error('Failed to create purchase notification:', notifyError);
        }

        // Notify the instructor about the new enrollment.
        try {
            if (course.instructorDetails?.userId) {
                await createNotification({
                    recipientId: course.instructorDetails.userId.toString(),
                    recipientType: 'instructor',
                    title: 'New course purchase',
                    message: `${user.name} just purchased "${course.courseName}". Your earnings have been updated.`,
                    type: 'success',
                    relatedId: course._id.toString(),
                    relatedType: 'course',
                });
            }
        } catch (notifyError) {
            console.error('Failed to create instructor purchase notification:', notifyError);
        }

        // Notify every admin about the new sale.
        try {
            const admins = await Admin.find().select('_id');
            for (const admin of admins) {
                await createNotification({
                    recipientId: admin._id.toString(),
                    recipientType: 'admin',
                    title: 'New course purchase',
                    message: `${user.name} just purchased "${course.courseName}".`,
                    type: 'info',
                    relatedId: course._id.toString(),
                    relatedType: 'course',
                });
            }
        } catch (notifyError) {
            console.error('Failed to create admin purchase notification:', notifyError);
        }

        try {
            await sendCoursePurchaseEmail({
                email: user.email,
                name: user.name,
                courseName: course.courseName,
                amount: transaction.amount,
                currency: transaction.currency,
                transactionReference: transaction.transactionReference,
            });
        } catch (emailError) {
            console.error('Failed to send purchase confirmation email:', emailError);
        }
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

        // #17 Ownership check — user can only verify their own transaction
        const requestingUserId = req.userId;
        if (requestingUserId && transaction.userId.toString() !== requestingUserId) {
            return res.status(403).json({
                status: 'failed',
                message: 'Forbidden: transaction does not belong to you'
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
            transaction.status = 'failed';
            transaction.flutterwaveTransactionId = transaction_id;
            await transaction.save();

            return res.status(400).json({
                status: 'failed',
                message: 'Payment was not successful',
                transaction
            });
        }

        // #17 Verify amount matches what was expected — prevents paying less than course price.
        // Mentorship transactions have no course; their amount is fixed at creation time.
        if (transaction.purpose !== 'mentorship') {
            const course = await Course.findById(transaction.courseId);
            if (course && verificationResponse.data.amount < transaction.amount) {
                transaction.status = 'failed';
                transaction.flutterwaveTransactionId = transaction_id;
                await transaction.save();
                return res.status(400).json({
                    status: 'failed',
                    message: 'Payment amount does not match expected amount'
                });
            }
        }

        transaction.flutterwaveTransactionId = transaction_id;
        if (transaction.purpose === 'mentorship') {
            await completeSuccessfulMentorship(transaction);
        } else {
            await completeSuccessfulPurchase(transaction, req);
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
 * Check the status of a payment and reconcile "stuck" pending transactions.
 * - Successful / failed / cancelled statuses are final and returned as-is.
 * - A pending transaction is re-verified against Flutterwave (by transaction id
 *   when provided, otherwise looked up by reference) and completed or failed.
 * - A pending transaction with no record at Flutterwave older than one hour is
 *   marked as cancelled so the user can start a fresh payment.
 */
export const handleGetPaymentStatus = async (req: Request<{ tx_ref: string }, {}, {}, { transaction_id?: string }>, res: Response<VerifyPaymentResT>) => {
    try {
        const { tx_ref } = req.params;
        const { transaction_id } = req.query;

        if (!tx_ref) {
            return res.status(400).json({
                status: 'failed',
                message: 'Transaction reference is required'
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

        // #23 Ownership check — user can only view their own transaction
        const requestingUserId = req.userId;
        if (requestingUserId && transaction.userId.toString() !== requestingUserId) {
            return res.status(403).json({
                status: 'failed',
                message: 'Forbidden: transaction does not belong to you'
            });
        }

        // Non-pending statuses are final.
        if (transaction.status !== 'pending') {
            return res.status(200).json({
                status: 'success',
                message: 'Payment status retrieved successfully',
                transaction
            });
        }

        // Reconcile a stuck pending payment against Flutterwave.
        let verification: FlutterwaveVerifyResponse | null = null;
        try {
            verification = transaction_id
                ? await verifyTransaction(transaction_id)
                : await verifyTransactionByReference(tx_ref);
        } catch (verifyError) {
            console.error('Flutterwave status reconciliation error:', verifyError);
            verification = null;
        }

        const flutterwaveStatus = verification?.data?.status ?? 'unknown';

        // No record at Flutterwave — payment never went through. Mark stale
        // pending transactions as cancelled so they don't block re-enrollment.
        if (flutterwaveStatus === 'unknown') {
            const staleThreshold = 60 * 60 * 1000; // 1 hour
            const updatedAt = new Date(transaction.updatedAt).getTime();
            if (Date.now() - updatedAt > staleThreshold) {
                transaction.status = 'cancelled';
                await transaction.save();
                return res.status(200).json({
                    status: 'success',
                    message: 'Pending payment was abandoned and marked as cancelled',
                    transaction
                });
            }
            return res.status(200).json({
                status: 'success',
                message: 'Payment is still pending',
                transaction
            });
        }

        if (flutterwaveStatus !== 'successful') {
            transaction.status = 'failed';
            transaction.flutterwaveTransactionId = String(verification?.data?.transaction_id ?? '');
            await transaction.save();
            return res.status(200).json({
                status: 'success',
                message: 'Payment was not successful',
                transaction
            });
        }

        // Verify amount matches what was expected.
        if ((verification?.data?.amount ?? 0) < transaction.amount) {
            transaction.status = 'failed';
            transaction.flutterwaveTransactionId = String(verification?.data?.transaction_id ?? '');
            await transaction.save();
            return res.status(200).json({
                status: 'success',
                message: 'Payment amount does not match expected amount',
                transaction
            });
        }

        transaction.flutterwaveTransactionId = String(verification?.data?.transaction_id ?? '');
        if (transaction.purpose === 'mentorship') {
            await completeSuccessfulMentorship(transaction);
        } else {
            await completeSuccessfulPurchase(transaction, req);
        }

        return res.status(200).json({
            status: 'success',
            message: 'Payment reconciled successfully',
            transaction
        });

    } catch (error) {
        console.error('Get payment status error:', error);
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

        // #23 Ownership check — users can only view their own transactions
        const requestingUserId = req.userId;
        if (requestingUserId && transaction.userId.toString() !== requestingUserId) {
            return res.status(403).json({
                status: 'failed',
                message: 'Forbidden: transaction does not belong to you'
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
