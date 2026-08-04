import { Request, Response } from 'express';
import User from '../models/user.model';
import { Instructor } from '../models/instructor.model';
import { ensureAffiliateAccount } from '../services/affiliate.service';

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

        return res.status(200).json({
            status: 'success',
            message: 'Affiliate stats retrieved successfully',
            stats: {
                affiliate_id: user.affiliate_id || null,
                isActive: !!user.affiliate_id,
                affiliate_money: user.affiliate_money || 0,
                totalEarnings: user.affiliate_money || 0,
                totalClicks: 0, // TODO: Implement click tracking
                totalConversions: 0 // TODO: Implement conversion tracking
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
