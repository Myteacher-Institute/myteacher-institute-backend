import { Request, Response, NextFunction } from 'express';
import { trackAffiliateClick } from '../services/affiliate-tracking.service';

export const trackAffiliateClickMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { affiliate } = req.query;
        const courseId = req.params.courseId || req.query.courseId;

        if (affiliate && typeof affiliate === 'string') {
            // Track the click
            const affiliateId = affiliate;
            const affiliateType = 'user'; // Default to user, can be enhanced to detect type
            
            const referralLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/course/${courseId || ''}?affiliate=${affiliateId}`;
            
            await trackAffiliateClick(
                affiliateId,
                affiliateType,
                referralLink,
                courseId as string,
                req.ip,
                req.get('user-agent')
            );
        }

        next();
    } catch (error) {
        console.error('Error in affiliate tracking middleware:', error);
        next(); // Continue even if tracking fails
    }
};
