import { Request, Response } from 'express';

import { User } from '../models';
import { Instructor } from '../models/instructor.model';
import config from '../config/env';
import { ensureAffiliateAccount } from './affiliate.service';
import logger, { getClientIp } from '../utils';
import { generateSession } from './session.service';

const FRONTEND_OAUTH_URL = `${process.env.FRONTEND_BASE_URL}/oauth/google`;

export const googleCallback = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const user = req.user as any;
        
        if (!user) {
            res.redirect(`${FRONTEND_OAUTH_URL}?status=auth_failed`);
            return;
        }

        const ip = getClientIp(req);
        const userAgent = req.headers['user-agent'] ?? '';

        // Normal users get an affiliate account automatically when they log in
        // with Google. Instructors activate it manually from Settings.
        if (user.role !== 'instructor' && user.role !== 'admin') {
            await ensureAffiliateAccount(user._id.toString(), 'user');
        }

        const sessionResult = await generateSession({
            ip,
            userAgent,
            userId: user._id.toString(),
        });

        if (!sessionResult.isSuccessful) {
            res.redirect(`${FRONTEND_OAUTH_URL}?status=session_failed`);
            return;
        }

        res.cookie(config['REFRESH_TOKEN_COOKIE_NAME'] as string, sessionResult.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000,
        });

        // Determine redirect based on user type and onboarding status
        let redirectUrl = `${FRONTEND_OAUTH_URL}?status=success`;
        
        if (user.role === 'instructor') {
            const instructor = await Instructor.findById(user._id);
            if (instructor && !instructor.isVerified) {
                redirectUrl = `${FRONTEND_OAUTH_URL}?status=pending_verification`;
            } else {
                redirectUrl = `${FRONTEND_OAUTH_URL}?status=success&redirect=/instructor`;
            }
        } else if (!user.hasOnboarded) {
            redirectUrl = `${FRONTEND_OAUTH_URL}?status=needs_onboarding`;
        } else {
            redirectUrl = `${FRONTEND_OAUTH_URL}?status=success&redirect=/dashboard`;
        }

        res.redirect(redirectUrl);
    } catch (error) {
        logger.error(`Error on @googleCallback: ${(error as Error)?.message ?? error}`);
        res.redirect(`${FRONTEND_OAUTH_URL}?status=server_error`);
    }
};
