import { Request, Response } from 'express';
import User from '../models/user.model';
import { Instructor } from '../models/instructor.model';
import { ensureAffiliateAccount } from '../services/affiliate.service';
import { getAffiliateStatistics, getRecentReferrals as getReferralsFromService } from '../services/affiliate-tracking.service';
import { createWithdrawalRequest, getWithdrawalHistory, processWithdrawal, getPendingWithdrawals } from '../services/affiliate-withdrawal.service';
import { getBankList } from '../services/flutterwave-payout.service';

type UserType = 'user' | 'instructor';

const resolveOwner = (req: Request) => {
    const userId = (req.userId as string | undefined) || req.body?.userId;
    const userType = (req.body?.userType || req.query?.userType) as UserType | undefined;
    return { userId, userType };
};

// Activate affiliate account for user or instructor (idempotent).
// Re-activating returns the existing affiliate_id instead of an error.
export const activateAffiliateAccount = async (req: Request, res: Response) => {
    try {
        const { userId, userType } = resolveOwner(req);

        if (!userId) {
            return res.status(401).json({
                status: 'failed',
                message: 'Unauthorized'
            });
        }
        if (!userType || !['user', 'instructor'].includes(userType)) {
            return res.status(400).json({
                status: 'failed',
                message: 'Invalid userType'
            });
        }

        const result = await ensureAffiliateAccount(userId, userType);

        if (!result.ok) {
            if (result.reason === 'not-found') {
                return res.status(404).json({
                    status: 'failed',
                    message: 'Account not found'
                });
            }
            return res.status(500).json({
                status: 'failed',
                message: 'Failed to generate unique affiliate ID'
            });
        }

        return res.status(200).json({
            status: 'success',
            message: result.created
                ? 'Affiliate account activated successfully'
                : 'Affiliate account already active',
            affiliate: {
                affiliate_id: result.affiliate_id,
                isActive: true
            }
        });
    } catch (error) {
        console.error('Error activating affiliate account:', error);
        return res.status(500).json({
            status: 'failed',
            message: 'Internal server error'
        });
    }
};

// Get affiliate account status for the authenticated user/instructor.
export const getAffiliateStatus = async (req: Request, res: Response) => {
    try {
        const { userId, userType } = resolveOwner(req);

        if (!userId) {
            return res.status(401).json({
                status: 'failed',
                message: 'Unauthorized'
            });
        }
        if (!userType || !['user', 'instructor'].includes(userType)) {
            return res.status(400).json({
                status: 'failed',
                message: 'Invalid userType'
            });
        }

        const Model: typeof User = (userType === 'user' ? User : Instructor) as typeof User;
        const user = await Model.findById(userId);

        if (!user) {
            return res.status(404).json({
                status: 'failed',
                message: 'Account not found'
            });
        }

        return res.status(200).json({
            status: 'success',
            message: 'Affiliate status retrieved successfully',
            affiliate: {
                affiliate_id: user.affiliate_id || null,
                isActive: !!user.affiliate_id,
                hasAffiliateAccount: user.hasAffiliateAccount ?? false,
                affiliate_money: user.affiliate_money || 0
            }
        });
    } catch (error) {
        console.error('Error getting affiliate status:', error);
        return res.status(500).json({
            status: 'failed',
            message: 'Internal server error'
        });
    }
};

// Generate affiliate link for a course
export const generateAffiliateLink = async (req: Request, res: Response) => {
    try {
        const { userId, userType } = resolveOwner(req);
        const { courseId } = req.body || {};

        if (!courseId) {
            return res.status(400).json({
                status: 'failed',
                message: 'courseId is required'
            });
        }
        if (!userId) {
            return res.status(401).json({
                status: 'failed',
                message: 'Unauthorized'
            });
        }
        if (!userType || !['user', 'instructor'].includes(userType)) {
            return res.status(400).json({
                status: 'failed',
                message: 'Invalid userType'
            });
        }

        const Model: typeof User = (userType === 'user' ? User : Instructor) as typeof User;
        const user = await Model.findById(userId);

        if (!user) {
            return res.status(404).json({
                status: 'failed',
                message: 'User not found'
            });
        }

        if (!user.affiliate_id) {
            return res.status(400).json({
                status: 'failed',
                message: 'Affiliate account not activated'
            });
        }

        const affiliateLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/course/${courseId}?affiliate=${user.affiliate_id}`;

        return res.status(200).json({
            status: 'success',
            message: 'Affiliate link generated successfully',
            affiliateLink
        });
    } catch (error) {
        console.error('Error generating affiliate link:', error);
        return res.status(500).json({
            status: 'failed',
            message: 'Internal server error'
        });
    }
};

// Get affiliate statistics
export const getAffiliateStats = async (req: Request, res: Response) => {
    try {
        const { userId, userType } = resolveOwner(req);

        if (!userId) {
            return res.status(401).json({
                status: 'failed',
                message: 'Unauthorized'
            });
        }
        if (!userType || !['user', 'instructor'].includes(userType)) {
            return res.status(400).json({
                status: 'failed',
                message: 'Invalid userType'
            });
        }

        const Model: typeof User = (userType === 'user' ? User : Instructor) as typeof User;
        const user = await Model.findById(userId);

        if (!user) {
            return res.status(404).json({
                status: 'failed',
                message: 'User not found'
            });
        }

        if (!user.affiliate_id) {
            return res.status(200).json({
                status: 'success',
                message: 'Affiliate not activated',
                stats: {
                    affiliate_id: null,
                    isActive: false,
                    affiliate_money: 0,
                    totalEarnings: 0,
                    pendingBalance: 0,
                    withdrawnAmount: 0,
                    totalClicks: 0,
                    totalSignups: 0,
                    paidEnrollments: 0
                }
            });
        }

        // Get comprehensive statistics using tracking service
        const stats = await getAffiliateStatistics(userId, userType);

        return res.status(200).json({
            status: 'success',
            message: 'Affiliate stats retrieved successfully',
            stats: {
                affiliate_id: user.affiliate_id,
                isActive: true,
                affiliate_money: stats.currentBalance,
                totalEarnings: stats.totalEarnings,
                pendingBalance: stats.pendingBalance,
                withdrawnAmount: stats.withdrawnAmount,
                totalClicks: stats.totalClicks,
                totalSignups: stats.totalSignups,
                paidEnrollments: stats.paidEnrollments,
                currentBalance: stats.currentBalance
            }
        });
    } catch (error) {
        console.error('Error getting affiliate stats:', error);
        return res.status(500).json({
            status: 'failed',
            message: 'Internal server error'
        });
    }
};

// Get recent referrals
export const getRecentReferrals = async (req: Request, res: Response) => {
    try {
        const { userId, userType } = resolveOwner(req);

        if (!userId) {
            return res.status(401).json({
                status: 'failed',
                message: 'Unauthorized'
            });
        }
        if (!userType || !['user', 'instructor'].includes(userType)) {
            return res.status(400).json({
                status: 'failed',
                message: 'Invalid userType'
            });
        }

        const Model: typeof User = (userType === 'user' ? User : Instructor) as typeof User;
        const user = await Model.findById(userId);

        if (!user) {
            return res.status(404).json({
                status: 'failed',
                message: 'User not found'
            });
        }

        if (!user.affiliate_id) {
            return res.status(200).json({
                status: 'success',
                message: 'Affiliate not activated',
                referrals: []
            });
        }

        // Get recent referrals using tracking service
        const referrals = await getReferralsFromService(userId, 10);

        return res.status(200).json({
            status: 'success',
            message: 'Recent referrals retrieved successfully',
            referrals
        });
    } catch (error) {
        console.error('Error getting recent referrals:', error);
        return res.status(500).json({
            status: 'failed',
            message: 'Internal server error'
        });
    }
};

// Create withdrawal request
export const createWithdrawal = async (req: Request, res: Response) => {
    try {
        const { userId, userType } = resolveOwner(req);
        const { amount, bankName, accountNumber, accountName } = req.body;

        if (!userId) {
            return res.status(401).json({
                status: 'failed',
                message: 'Unauthorized'
            });
        }
        if (!userType || !['user', 'instructor'].includes(userType)) {
            return res.status(400).json({
                status: 'failed',
                message: 'Invalid userType'
            });
        }

        if (!amount || !bankName || !accountNumber || !accountName) {
            return res.status(400).json({
                status: 'failed',
                message: 'Missing required fields'
            });
        }

        const result = await createWithdrawalRequest(userId, userType, amount, {
            bankName,
            accountNumber,
            accountName
        });

        if (!result.success) {
            return res.status(400).json({
                status: 'failed',
                message: result.message
            });
        }

        return res.status(200).json({
            status: 'success',
            message: 'Withdrawal request created successfully',
            withdrawal: result.withdrawal
        });
    } catch (error) {
        console.error('Error creating withdrawal:', error);
        return res.status(500).json({
            status: 'failed',
            message: 'Internal server error'
        });
    }
};

// Get withdrawal history
export const getWithdrawals = async (req: Request, res: Response) => {
    try {
        const { userId, userType } = resolveOwner(req);

        if (!userId) {
            return res.status(401).json({
                status: 'failed',
                message: 'Unauthorized'
            });
        }
        if (!userType || !['user', 'instructor'].includes(userType)) {
            return res.status(400).json({
                status: 'failed',
                message: 'Invalid userType'
            });
        }

        const withdrawals = await getWithdrawalHistory(userId, userType);

        return res.status(200).json({
            status: 'success',
            message: 'Withdrawal history retrieved successfully',
            withdrawals
        });
    } catch (error) {
        console.error('Error getting withdrawals:', error);
        return res.status(500).json({
            status: 'failed',
            message: 'Internal server error'
        });
    }
};

// Process withdrawal (admin only)
export const adminProcessWithdrawal = async (req: Request, res: Response) => {
    try {
        const { withdrawalId } = req.params;
        const { status, rejectionReason, transactionReference } = req.body;

        if (!withdrawalId || Array.isArray(withdrawalId)) {
            return res.status(400).json({
                status: 'failed',
                message: 'Withdrawal ID is required'
            });
        }

        if (!status || !['completed', 'rejected', 'processing'].includes(status)) {
            return res.status(400).json({
                status: 'failed',
                message: 'Invalid status'
            });
        }

        const result = await processWithdrawal(withdrawalId, status, rejectionReason, transactionReference);

        if (!result.success) {
            return res.status(400).json({
                status: 'failed',
                message: result.message
            });
        }

        return res.status(200).json({
            status: 'success',
            message: result.message
        });
    } catch (error) {
        console.error('Error processing withdrawal:', error);
        return res.status(500).json({
            status: 'failed',
            message: 'Internal server error'
        });
    }
};

// Get pending withdrawals (admin only)
export const getAdminPendingWithdrawals = async (req: Request, res: Response) => {
    try {
        const withdrawals = await getPendingWithdrawals();

        return res.status(200).json({
            status: 'success',
            message: 'Pending withdrawals retrieved successfully',
            withdrawals
        });
    } catch (error) {
        console.error('Error getting pending withdrawals:', error);
        return res.status(500).json({
            status: 'failed',
            message: 'Internal server error'
        });
    }
};

// Get bank list for withdrawal
export const getBanks = async (req: Request, res: Response) => {
    try {
        const result = await getBankList();

        if (result.success) {
            return res.status(200).json({
                status: 'success',
                message: 'Bank list retrieved successfully',
                banks: result.data
            });
        } else {
            return res.status(500).json({
                status: 'failed',
                message: result.message
            });
        }
    } catch (error) {
        console.error('Error getting bank list:', error);
        return res.status(500).json({
            status: 'failed',
            message: 'Internal server error'
        });
    }
};
