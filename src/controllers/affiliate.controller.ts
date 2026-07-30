import { Request, Response } from 'express';
import User from '../models/user.model';
import Instructor from '../models/instructor.model';
import crypto from 'crypto';

// Helper function to generate encrypted affiliate ID
const generateAffiliateId = (courseId: string): string => {
    // Generate 6 alphanumeric characters
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    

    
    // Encrypt with course ID using simple hash for security
    const hash = crypto.createHash('sha256').update(result + courseId).digest('hex');
    // Take first 8 characters of hash and append to result
    return result + hash.substring(0, 8);
};

// Activate affiliate account for user or instructor
export const activateAffiliateAccount = async (req: Request, res: Response) => {
    try {
        const { userId, userType } = req.body;

        if (!userId || !userType) {
            return res.status(400).json({
                status: 'failed',
                message: 'userId and userType are required'
            });
        }

        let user;
        if (userType === 'user') {
            user = await User.findById(userId);
        } else if (userType === 'instructor') {
            user = await Instructor.findById(userId);
        } else {
            return res.status(400).json({
                status: 'failed',
                message: 'Invalid userType'
            });
        }

        if (!user) {
            return res.status(404).json({
                status: 'failed',
                message: 'User not found'
            });
        }

        // Check if affiliate account already exists
        if (user.affiliate_id) {
            return res.status(400).json({
                status: 'failed',
                message: 'Affiliate account already activated'
            });
        }

        // Generate unique affiliate ID
        let affiliateId;
        let isUnique = false;
        let attempts = 0;

        while (!isUnique && attempts < 10) {
            affiliateId = generateAffiliateId(userId);
            
            // Check uniqueness
            const existingUser = await User.findOne({ affiliate_id: affiliateId });
            const existingInstructor = await Instructor.findOne({ affiliate_id: affiliateId });
            
            if (!existingUser && !existingInstructor) {
                isUnique = true;
            }
            attempts++;
        }

        if (!isUnique) {
            return res.status(500).json({
                status: 'failed',
                message: 'Failed to generate unique affiliate ID'
            });
        }

        // Update user with affiliate information
        if (userType === 'user') {
            await User.findByIdAndUpdate(userId, {
                affiliate_id: affiliateId,
                hasAffiliateAccount: true,
                affiliate_money: 0
            });
        } else {
            await Instructor.findByIdAndUpdate(userId, {
                affiliate_id: affiliateId,
                affiliate_money: 0
            });
        }

        return res.status(200).json({
            status: 'success',
            message: 'Affiliate account activated successfully',
            affiliate: {
                affiliate_id: affiliateId,
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

// Generate affiliate link for a course
export const generateAffiliateLink = async (req: Request, res: Response) => {
    try {
        const { courseId, userId, userType } = req.body;

        if (!courseId || !userId || !userType) {
            return res.status(400).json({
                status: 'failed',
                message: 'courseId, userId, and userType are required'
            });
        }

        let user;
        if (userType === 'user') {
            user = await User.findById(userId);
        } else if (userType === 'instructor') {
            user = await Instructor.findById(userId);
        } else {
            return res.status(400).json({
                status: 'failed',
                message: 'Invalid userType'
            });
        }

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

        // Generate affiliate link
        const affiliateLink = `${process.env.FRONTEND_URL}/course/${courseId}?affiliate=${user.affiliate_id}`;

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
        const { userId, userType } = req.body;

        if (!userId || !userType) {
            return res.status(400).json({
                status: 'failed',
                message: 'userId and userType are required'
            });
        }

        let user;
        if (userType === 'user') {
            user = await User.findById(userId);
        } else if (userType === 'instructor') {
            user = await Instructor.findById(userId);
        } else {
            return res.status(400).json({
                status: 'failed',
                message: 'Invalid userType'
            });
        }

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
