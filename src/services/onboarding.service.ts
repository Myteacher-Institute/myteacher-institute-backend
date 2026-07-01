import bcrypt from 'bcryptjs';
import { Request } from 'express';

import { User } from '../models';
import { generateSession } from './session.service';
import logger, { generateJWT, getClientIp } from '../utils';
import { handleCompleteOnboardingResT } from '../types/auth.types';

export const completeOnboarding = async (
    req: Request<any, any, { name: string; userId: string; password: string }>
): Promise<{ status: number; body: handleCompleteOnboardingResT }> => {
    try {
        const { name, userId, password } = req.body || {};

        if (!userId || typeof userId !== 'string') {
            return {
                status: 400,
                body: { status: 'failed', message: 'User ID is required' },
            };
        }

        if (!name || typeof name !== 'string') {
            return {
                status: 400,
                body: { status: 'failed', message: 'Name is required' },
            };
        }

        if (!password || typeof password !== 'string' || password.length < 6) {
            return {
                status: 400,
                body: { status: 'failed', message: 'Password must be at least 6 characters long' },
            };
        }

        const user = await User.findById(userId);

        if (!user) {
            return {
                status: 400,
                body: { status: 'failed', message: 'User not found' },
            };
        }

        if (user.hasOnboarded) {
            return {
                status: 400,
                body: { status: 'failed', message: 'User already onboarded' },
            };
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await User.updateOne(
            { _id: userId },
            {
                $set: {
                    name,
                    password: hashedPassword,
                    hasOnboarded: true,
                },
            }
        );

        const updatedUser = await User.findById(userId);

        if (!updatedUser) {
            return {
                status: 500,
                body: { status: 'failed', message: 'Unable to load updated user' },
            };
        }

        // ✅ SESSION + TOKEN (matches verifyOtp pattern)
        const ip = getClientIp(req);
        const userAgent = req.get('User-Agent') || '';

        const sessionRes = await generateSession({
            ip,
            userAgent,
            userId: userId,
        });

        if (!sessionRes.isSuccessful) {
            return {
                status: 400,
                body: { status: 'failed', message: sessionRes.reason },
            };
        }

        const accessToken = generateJWT({
            sessionId: sessionRes.sessionId,
            type: 'access',
            userId: userId,
        });

        return {
            status: 200,
            body: {
                status: 'success',
                message: 'Onboarding completed successfully',
                authUser: updatedUser,
                accessToken: accessToken as string,
            },
        };
    } catch (error) {
        logger.error(`Error on @completeOnboarding: ${(error as Error)?.message ?? error}`);

        return {
            status: 500,
            body: {
                status: 'failed',
                message: 'Internal server error',
            },
        };
    }
};
