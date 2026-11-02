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
    res: Response,
    userType: string = 'student'
): Promise<void> => {
    try {
        const user = req.user as any;
        
        if (!user) {
            res.redirect(`${FRONTEND_OAUTH_URL}?status=auth_failed`);
            return;
        }

        const ip = getClientIp(req);
        const userAgent = req.headers['user-agent'] ?? '';

        // If user_type is instructor, ensure the user is treated as instructor
        if (userType === 'instructor') {
            // Check if user is already an instructor
            const instructor = await Instructor.findById(user._id);
            
            if (!instructor) {
                // If not, check if email exists in instructor collection
                const existingInstructor = await Instructor.findOne({ email: user.email });
                
                if (existingInstructor) {
                    // Link the Google ID to the existing instructor account
                    existingInstructor.googleId = user.googleId;
                    if (!existingInstructor.profilePicture && user.profilePicture) {
                        existingInstructor.profilePicture = user.profilePicture;
                    }
                    await existingInstructor.save();
                    
                    // Generate session for instructor
                    const sessionResult = await generateSession({
                        ip,
                        userAgent,
                        userId: existingInstructor._id.toString(),
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

                    res.redirect(`${FRONTEND_OAUTH_URL}?status=success&redirect=/instructor`);
                    return;
                } else {
                    // Create new instructor account from user data
                    const newInstructor = await Instructor.create({
                        name: user.name,
                        email: user.email,
                        googleId: user.googleId,
                        profilePicture: user.profilePicture,
                        isVerified: true,
                        specialization: 'General',
                    });

                    const sessionResult = await generateSession({
                        ip,
                        userAgent,
                        userId: newInstructor._id.toString(),
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

                    res.redirect(`${FRONTEND_OAUTH_URL}?status=success&redirect=/instructor`);
                    return;
                }
            }

            // User is already an instructor, generate session for instructor
            const sessionResult = await generateSession({
                ip,
                userAgent,
                userId: instructor._id.toString(),
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

            res.redirect(`${FRONTEND_OAUTH_URL}?status=success&redirect=/instructor`);
            return;
        }

        // Normal users get an affiliate account automatically when they log in
        // with Google. Instructors activate it manually from Settings.
        if (user.role !== 'instructor' && user.role !== 'admin') {
            await ensureAffiliateAccount(user._id.toString(), 'user');
        }

        // Google already verified the identity (email, name, avatar), so the
        // account never needs a password/onboarding form. This also covers
        // existing users linking Google for the first time.
        if (user.googleId && user.hasOnboarded !== true) {
            await User.updateOne({ _id: user._id }, { $set: { hasOnboarded: true } });
            user.hasOnboarded = true;
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
        } else if (user.hasOnboarded !== true) {
            redirectUrl = `${FRONTEND_OAUTH_URL}?status=needs_onboarding`;
        } else {
            redirectUrl = `${FRONTEND_OAUTH_URL}?status=success&redirect=/student`;
        }

        res.redirect(redirectUrl);
    } catch (error) {
        logger.error(`Error on @googleCallback: ${(error as Error)?.message ?? error}`);
        res.redirect(`${FRONTEND_OAUTH_URL}?status=server_error`);
    }
};
