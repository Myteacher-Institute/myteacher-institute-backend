import { AffiliateWithdrawal } from '../models/affiliate-withdrawal.model';
import User from '../models/user.model';
import { Instructor } from '../models/instructor.model';
import { createPayout, verifyPayout } from './flutterwave-payout.service';

// Create a withdrawal request
export const createWithdrawalRequest = async (
    affiliateId: string,
    affiliateType: 'user' | 'instructor',
    amount: number,
    bankDetails: {
        bankName: string;
        accountNumber: string;
        accountName: string;
    }
) => {
    try {
        // Validate minimum withdrawal amount
        if (amount < 1000) {
            return { success: false, message: 'Minimum withdrawal amount is ₦1,000' };
        }

        // Check affiliate's current balance
        let affiliate;
        if (affiliateType === 'user') {
            affiliate = await User.findById(affiliateId);
        } else {
            affiliate = await Instructor.findById(affiliateId);
        }

        if (!affiliate) {
            return { success: false, message: 'Affiliate account not found' };
        }

        if (!affiliate.affiliate_id) {
            return { success: false, message: 'Affiliate account not activated' };
        }

        if (!affiliate.affiliate_money || affiliate.affiliate_money < amount) {
            return { success: false, message: 'Insufficient balance' };
        }

        // Check for pending withdrawals
        const pendingWithdrawals = await AffiliateWithdrawal.countDocuments({
            affiliateId,
            status: { $in: ['pending', 'processing'] }
        });

        if (pendingWithdrawals > 0) {
            return { success: false, message: 'You have pending withdrawals. Please wait for them to be processed.' };
        }

        // Create withdrawal request
        const withdrawal = await AffiliateWithdrawal.create({
            affiliateId,
            affiliateType,
            amount,
            bankName: bankDetails.bankName,
            accountNumber: bankDetails.accountNumber,
            accountName: bankDetails.accountName,
            status: 'pending'
        });

        // Deduct amount from affiliate's balance (will be refunded if rejected)
        if (affiliateType === 'user') {
            await User.findByIdAndUpdate(affiliateId, {
                $inc: { affiliate_money: -amount }
            });
        } else {
            await Instructor.findByIdAndUpdate(affiliateId, {
                $inc: { affiliate_money: -amount }
            });
        }

        return { success: true, withdrawal };
    } catch (error) {
        console.error('Error creating withdrawal request:', error);
        return { success: false, message: 'Failed to create withdrawal request' };
    }
};

// Get withdrawal history for an affiliate
export const getWithdrawalHistory = async (
    affiliateId: string,
    affiliateType: 'user' | 'instructor'
) => {
    try {
        const withdrawals = await AffiliateWithdrawal.find({ affiliateId })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();

        return withdrawals;
    } catch (error) {
        console.error('Error getting withdrawal history:', error);
        return [];
    }
};

// Process withdrawal (admin function)
export const processWithdrawal = async (
    withdrawalId: string,
    status: 'completed' | 'rejected' | 'processing',
    rejectionReason?: string,
    transactionReference?: string
) => {
    try {
        const withdrawal = await AffiliateWithdrawal.findById(withdrawalId);

        if (!withdrawal) {
            return { success: false, message: 'Withdrawal not found' };
        }

        if (withdrawal.status !== 'pending' && withdrawal.status !== 'processing') {
            return { success: false, message: 'Withdrawal already processed' };
        }

        if (status === 'rejected') {
            // Refund the amount back to affiliate
            if (withdrawal.affiliateType === 'user') {
                await User.findByIdAndUpdate(withdrawal.affiliateId, {
                    $inc: { affiliate_money: withdrawal.amount }
                });
            } else {
                await Instructor.findByIdAndUpdate(withdrawal.affiliateId, {
                    $inc: { affiliate_money: withdrawal.amount }
                });
            }

            withdrawal.status = 'rejected';
            withdrawal.rejectionReason = rejectionReason;
            await withdrawal.save();

            return { success: true, message: 'Withdrawal rejected and amount refunded' };
        }

        if (status === 'processing') {
            // Mark as processing and initiate Flutterwave payout
            withdrawal.status = 'processing';
            await withdrawal.save();

            // Initiate Flutterwave payout
            const payoutResult = await createPayout({
                account_bank: withdrawal.bankName,
                account_number: withdrawal.accountNumber,
                amount: withdrawal.amount,
                currency: 'NGN',
                beneficiary_name: withdrawal.accountName,
                reference: `AFFILIATE-WITHDRAWAL-${withdrawal._id}-${Date.now()}`,
                narration: `Affiliate withdrawal for ${withdrawal.affiliateType}`
            });

            if (payoutResult.success) {
                withdrawal.transactionReference = payoutResult.data?.reference;
                await withdrawal.save();

                return { success: true, message: 'Payout initiated successfully with Flutterwave' };
            } else {
                // If Flutterwave fails, revert to pending status
                withdrawal.status = 'pending';
                await withdrawal.save();

                return { success: false, message: `Payout failed: ${payoutResult.message}` };
            }
        }

        if (status === 'completed') {
            // Verify payout with Flutterwave before marking as completed
            if (withdrawal.transactionReference) {
                const verificationResult = await verifyPayout(withdrawal.transactionReference);

                if (verificationResult.success && verificationResult.data?.status === 'successful') {
                    withdrawal.status = 'completed';
                    withdrawal.processedAt = new Date();
                    await withdrawal.save();

                    return { success: true, message: 'Withdrawal completed successfully' };
                } else {
                    return { success: false, message: 'Payout verification failed' };
                }
            } else {
                // If no transaction reference, mark as completed manually
                withdrawal.status = 'completed';
                withdrawal.processedAt = new Date();
                await withdrawal.save();

                return { success: true, message: 'Withdrawal completed successfully' };
            }
        }

        return { success: false, message: 'Invalid status' };
    } catch (error) {
        console.error('Error processing withdrawal:', error);
        return { success: false, message: 'Failed to process withdrawal' };
    }
};

// Get pending withdrawals for admin
export const getPendingWithdrawals = async () => {
    try {
        const withdrawals = await AffiliateWithdrawal.find({
            status: { $in: ['pending', 'processing'] }
        })
            .sort({ createdAt: 1 })
            .lean();

        // Fetch affiliate details
        const withdrawalsWithDetails = await Promise.all(
            withdrawals.map(async (withdrawal) => {
                let affiliate;
                if (withdrawal.affiliateType === 'user') {
                    affiliate = await User.findById(withdrawal.affiliateId).select('name email profilePicture');
                } else {
                    affiliate = await Instructor.findById(withdrawal.affiliateId).select('name email profilePicture');
                }
                
                return {
                    ...withdrawal,
                    affiliateName: affiliate?.name || 'Unknown',
                    affiliateEmail: affiliate?.email || 'Unknown',
                    affiliateAvatar: affiliate?.profilePicture || null
                };
            })
        );

        return withdrawalsWithDetails;
    } catch (error) {
        console.error('Error getting pending withdrawals:', error);
        return [];
    }
};
