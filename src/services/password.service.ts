import bcrypt from 'bcryptjs';
import { Request } from 'express';

import config from '@/config/env';
import { User, Otp, Session } from '@/models';
import { generateSession } from './session.service';
import { handleVerifyPasswordResT } from '@/types/auth.types';
import logger, { generateJWT, getClientIp, validateVerifyPasswordInput } from '@/utils';

export const verifyPassword = async (
    req: Request<any, any, { password?: string; email?: string }>
): Promise<{ status: number; body: handleVerifyPasswordResT; cookie?: { name: string; value: string } }> => {
    try {
        const { email, password } = req.body;

        const validationResult = validateVerifyPasswordInput(email, password);
        if (validationResult !== true) {
            return { status: 400, body: validationResult };
        }

        const findUser = await User.findOne({ email });

        if (!findUser || !findUser.hasOnboarded) {
            return { status: 404, body: { errorOnInput: false, status: 'failed', message: 'Wrong endpoint. Please contact support.' } };
        }

        const isPasswordCorrect = await bcrypt.compare(password!, findUser.password);

        if (!isPasswordCorrect) {
            return { status: 400, body: { errorOnInput: 'password', status: 'failed', message: 'The password you entered is incorrect. Please try again.' } };
        }

        const userIp = getClientIp(req);
        const userAgent = req.get('User-Agent') || '';

        const trustedSession = await Session.findOne({
            userId: findUser._id,
            ip: userIp,
            userAgent,
            isRevoked: false,
        });

        if (trustedSession) {
            const sessionResult = await generateSession({ ip: userIp, userAgent, userId: findUser._id.toString() });

            if (!sessionResult.isSuccessful) {
                return { status: 400, body: { errorOnInput: false, status: 'failed', message: sessionResult.reason } };
            }

            const access_code = generateJWT({ sessionId: sessionResult.sessionId, type: 'access', userId: findUser._id.toString() });

            return {
                status: 200,
                body: { status: 'success', isTrusted: true, message: 'Welcome back! You have successfully logged in to your account.', access_code: access_code as string },
                cookie: { name: config['REFRESH_TOKEN_COOKIE_NAME'], value: sessionResult.token },
            };
        }

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        await Otp.create({
            accountToVerifyId: findUser._id,
            otp: otpCode,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            isUsed: false,
            useCase: 'onboarded-account',
        });

        return {
            status: 200,
            body: { status: 'success', isTrusted: false, isGiveCode: true, isCompleted: false, message: 'New device detected. Please verify with the code sent to your email.' },
        };
    } catch (error) {
        logger.error(`Error on @verifyPassword: ${(error as Error)?.message ?? error}`);
        return { status: 500, body: { errorOnInput: false, status: 'failed', message: 'Internal server error' } };
    }
};
