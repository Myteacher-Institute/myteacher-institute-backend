import { AffiliateReferral } from '../models/affiliate-referral.model';
import { AffiliateClick } from '../models/affiliate-click.model';
import User from '../models/user.model';
import { Instructor } from '../models/instructor.model';
import Transaction from '../models/transaction.model';

// Track when someone clicks on an affiliate link
export const trackAffiliateClick = async (
    affiliateId: string,
    affiliateType: 'user' | 'instructor',
    referralLink: string,
    courseId?: string,
    ipAddress?: string,
    userAgent?: string
) => {
    try {
        await AffiliateClick.create({
            affiliateId,
            affiliateType,
            referralLink,
            courseId,
            ipAddress,
            userAgent
        });
        return { success: true };
    } catch (error) {
        console.error('Error tracking affiliate click:', error);
        return { success: false };
    }
};

// Track when someone signs up from an affiliate link
export const trackAffiliateSignup = async (
    affiliateId: string,
    affiliateType: 'user' | 'instructor',
    referredUserId: string,
    referredEmail: string,
    referralLink: string
) => {
    try {
        // Create referral record
        await AffiliateReferral.create({
            affiliateId,
            affiliateType,
            referredUserId,
            referredEmail,
            referralLink,
            status: 'signup'
        });
        return { success: true };
    } catch (error) {
        console.error('Error tracking affiliate signup:', error);
        return { success: false };
    }
};

// Track when someone enrolls in a course via affiliate link
export const trackAffiliateEnrollment = async (
    affiliateId: string,
    affiliateType: 'user' | 'instructor',
    referredUserId: string,
    courseId: string,
    coursePrice: number,
    referralLink: string
) => {
    try {
        // Find the referral record
        const referral = await AffiliateReferral.findOne({
            affiliateId,
            referredUserId,
            courseId
        });

        if (!referral) {
            // Create new referral record if it doesn't exist
            await AffiliateReferral.create({
                affiliateId,
                affiliateType,
                referredUserId,
                courseId,
                referralLink,
                status: 'enrolled',
                earnings: 0,
                commission: 0.20
            });
        } else {
            // Update existing referral
            referral.status = 'enrolled';
            await referral.save();
        }

        return { success: true };
    } catch (error) {
        console.error('Error tracking affiliate enrollment:', error);
        return { success: false };
    }
};

// Calculate and apply earnings when a course payment is completed
export const processAffiliateEarnings = async (
    affiliateId: string,
    affiliateType: 'user' | 'instructor',
    referredUserId: string,
    courseId: string,
    coursePrice: number
) => {
    try {
        // Find the referral record
        const referral = await AffiliateReferral.findOne({
            affiliateId,
            referredUserId,
            courseId,
            status: 'enrolled'
        });

        if (!referral) {
            return { success: false, message: 'Referral not found' };
        }

        // Calculate earnings (20% commission)
        const commission = 0.20;
        const earnings = coursePrice * commission;

        // Update referral record
        referral.earnings = earnings;
        referral.status = 'completed';
        await referral.save();

        // Update affiliate's earnings in their account
        const Model = affiliateType === 'user' ? User : Instructor;
        await (Model as any).findByIdAndUpdate(affiliateId, {
            $inc: { affiliate_money: earnings }
        });

        return { success: true, earnings };
    } catch (error) {
        console.error('Error processing affiliate earnings:', error);
        return { success: false, message: 'Failed to process earnings' };
    }
};

// Get affiliate statistics
export const getAffiliateStatistics = async (
    affiliateId: string,
    affiliateType: 'user' | 'instructor'
) => {
    try {
        // Get total clicks
        const totalClicks = await AffiliateClick.countDocuments({ affiliateId });

        // Get total signups
        const totalSignups = await AffiliateReferral.countDocuments({
            affiliateId,
            status: { $in: ['signup', 'enrolled', 'completed'] }
        });

        // Get paid enrollments
        const paidEnrollments = await AffiliateReferral.countDocuments({
            affiliateId,
            status: 'completed'
        });

        // Get total earnings from completed referrals
        const completedReferrals = await AffiliateReferral.find({
            affiliateId,
            status: 'completed'
        });
        const totalEarnings = completedReferrals.reduce((sum, ref) => sum + ref.earnings, 0);

        // Get pending balance (earnings from enrolled but not yet completed)
        const enrolledReferrals = await AffiliateReferral.find({
            affiliateId,
            status: 'enrolled'
        });
        const pendingBalance = enrolledReferrals.reduce((sum, ref) => sum + (ref.earnings || 0), 0);

        // Get user's current balance
        const Model = affiliateType === 'user' ? User : Instructor;
        const user = await (Model as any).findById(affiliateId);
        const currentBalance = user?.affiliate_money || 0;

        // Calculate withdrawn amount (total earnings - current balance - pending)
        const withdrawnAmount = Math.max(0, totalEarnings - currentBalance - pendingBalance);

        return {
            totalClicks,
            totalSignups,
            paidEnrollments,
            totalEarnings,
            pendingBalance,
            withdrawnAmount,
            currentBalance
        };
    } catch (error) {
        console.error('Error getting affiliate statistics:', error);
        return {
            totalClicks: 0,
            totalSignups: 0,
            paidEnrollments: 0,
            totalEarnings: 0,
            pendingBalance: 0,
            withdrawnAmount: 0,
            currentBalance: 0
        };
    }
};

// Get recent referrals for an affiliate
export const getRecentReferrals = async (
    affiliateId: string,
    limit: number = 10
) => {
    try {
        const referrals = await AffiliateReferral.find({ affiliateId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        // Fetch user details for referred users
        const referralsWithDetails = await Promise.all(
            referrals.map(async (referral) => {
                let referredUser = null;
                if (referral.referredUserId) {
                    referredUser = await User.findById(referral.referredUserId).select('name email profilePicture');
                }

                return {
                    avatar: referredUser?.profilePicture || 'https://ui-avatars.com/api/?name=User&background=random',
                    name: referredUser?.name || referral.referredEmail || 'Unknown',
                    course: referral.courseId ? `Course #${referral.courseId.slice(-6)}` : 'General Signup',
                    earnings: `₦${referral.earnings.toLocaleString()}`,
                    status: referral.status === 'completed' ? 'Enrolled' : 
                            referral.status === 'enrolled' ? 'Pending' : 
                            referral.status === 'signup' ? 'Sign Up' : 'Pending'
                };
            })
        );

        return referralsWithDetails;
    } catch (error) {
        console.error('Error getting recent referrals:', error);
        return [];
    }
};
