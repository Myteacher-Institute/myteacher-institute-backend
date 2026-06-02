import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';

import config from '@/config/env';
import { User, Otp, Session } from '@/models';
import { sendVerificationEmail } from './email.service';
import { generateSession } from '@/utils/create-session';
import { handleAuthenticateResT, handleVerifyPasswordResT } from '@/types/auth.types';
import logger, { generateJWT, getClientIp, validateVerifyPasswordInput } from '@/utils';

export const authenticateUser = async (
  req: Request<any, any, { email: string, role: "user" | "instructor" }>
): Promise<{ status: number; body: handleAuthenticateResT }> => {
  try {
    const { email, role } = req.body || {};

    if (!email) {
      return { status: 400, body: { errorOnInput: true, status: 'failed', message: 'Email is required' } };
    }

    if (!role || !['user', 'instructor'].includes(role)) {
      return { status: 400, body: { errorOnInput: true, status: 'failed', message: 'Valid role is required (user or instructor)' } };
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return { status: 400, body: { errorOnInput: true, status: 'failed', message: 'Invalid email format' } };
    }

    const findUser = await User.findOne({ email });

    if (findUser) {
      if (findUser.hasOnboarded) {
        return {
          status: 200,
          body: { status: 'success', instruction: 'give-password', message: 'User onboarded, password required' },
        };
      }

      const emailStatus = await sendVerificationEmail(findUser._id.toString(), findUser.email, 'new-account');

      if (emailStatus === 'rate-limited') {
        return { status: 429, body: { errorOnInput: false, status: 'failed', message: 'Too many attempts. Please wait 15 minutes to request another code.' } };
      }

      if (emailStatus === 'error') {
        return { status: 500, body: { errorOnInput: false, status: 'failed', message: 'Failed to send verification email. Please try again.' } };
      }

      return {
        status: 200,
        body: { status: 'success', instruction: 'give-code', message: 'An OTP code has been sent to your email. Please verify to continue.' },
      };
    }

    const newUser = await User.create({ email, role });
    const emailStatus = await sendVerificationEmail(newUser._id.toString(), newUser.email, 'new-account');

    if (emailStatus === 'rate-limited') {
      return { status: 429, body: { errorOnInput: false, status: 'failed', message: 'Too many attempts. Please wait 15 minutes to request another code.' } };
    }

    if (emailStatus === 'error') {
      return { status: 500, body: { errorOnInput: false, status: 'failed', message: 'Failed to send verification email. Please try again.' } };
    }

    return {
      status: 200,
      body: { status: 'success', instruction: 'give-code', message: 'An OTP code has been sent to your email. Please verify to continue.' },
    };
  } catch (error) {
    logger.error(`Error on @authenticateUser: ${(error as Error)?.message ?? error}`);
    return { status: 500, body: { errorOnInput: false, status: 'failed', message: 'Internal server error' } };
  }
};

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
