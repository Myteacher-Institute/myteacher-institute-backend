import bcrypt from 'bcryptjs';
import { Request } from 'express';

import { User, Otp, Session } from '../models';
import { generateSession } from './session.service';
import { sendResetPasswordEmail } from './email.service';
import { ensureAffiliateAccount } from './affiliate.service';
import logger, { generateJWT, getClientIp, getHandleVerifyOtpSuccessMessage, sanitizeString } from '../utils';

import {
  handleVerifyOtpResT,
  handleSendResetInstructionsResT,
  handleResetPasswordWithCodeResT,
} from '../types/auth.types';

export const verifyOtp = async (
  req: Request<any, any, { otp: string; email?: string }>
): Promise<{ status: number; body: handleVerifyOtpResT }> => {
  try {
    const { otp } = req.body || {};

    const safeOtp = sanitizeString(otp);
    if (!safeOtp || typeof safeOtp !== 'string') {
      return { status: 400, body: { status: 'failed', message: 'OTP is required and must be a string' } };
    }

    if (safeOtp.length !== 6 || !/^\d{6}$/.test(safeOtp)) {
      return { status: 400, body: { status: 'failed', message: 'OTP must be exactly 6 digits' } };
    }

    // #16 Atomic find-and-delete to prevent race condition / OTP reuse
    const findOtp = await Otp.findOneAndDelete({
      otp: safeOtp,
      accountType: 'user',
      isUsed: false,
      expiresAt: { $gt: new Date() }, // #25 expiry enforced at DB query level
    });

    if (!findOtp) {
      return { status: 400, body: { status: 'failed', message: 'The verification code you entered is invalid or has expired. Please request a new one.' } };
    }

    const findUser = await User.findById(findOtp.accountToVerifyId);

    if (!findUser) {
      return { status: 400, body: { status: 'failed', message: 'User account not found. Please contact support.' } };
    }

    const ip = getClientIp(req);
    const userAgent = req.get('User-Agent') || '';

    if (findOtp.useCase === 'new-account') {
      await User.updateOne({ _id: findUser._id }, { $set: { isEmailVerified: true } });
      return {
        status: 200,
        body: {
          status: 'success',
          message: 'OTP verified. Continue onboarding.',
          nextStep: 'onboarding',
          userId: findUser._id.toString(),
        },
      };
    }

    if (findOtp.useCase === 'onboarded-account') {
      // Auto-create the affiliate account for normal users on every login.
      if (findUser.role !== 'instructor' && findUser.role !== 'admin') {
        await ensureAffiliateAccount(findUser._id.toString(), 'user');
      }

      const sessionRes = await generateSession({ ip, userAgent, userId: findUser._id.toString() });

      if (!sessionRes.isSuccessful) {
        return { status: 400, body: { status: 'failed', message: sessionRes.reason } };
      }

      const access_code = generateJWT({ sessionId: sessionRes.sessionId, type: 'access', userId: findUser._id.toString() });

      return {
        status: 200,
        body: {
          status: 'success',
          message: getHandleVerifyOtpSuccessMessage(findOtp.useCase),
          authUser: findUser,
          accessToken: access_code as string,
          cookie: {
            name: process.env.REFRESH_TOKEN_COOKIE_NAME || 'refresh_token',
            value: sessionRes.token
          }
        },
      };
    }

    if (findOtp.useCase === 'login') {
      // Ensure online status fields exist
      const { ensureOnlineStatusFields } = await import('./user-status.service');
      await ensureOnlineStatusFields(findUser._id.toString(), 'user');
      
      // Auto-create the affiliate account for normal users on every login.
      await ensureAffiliateAccount(findUser._id.toString(), 'user');
      
      // Set user as online
      await User.updateOne(
        { _id: findUser._id },
        { $set: { isOnline: true, lastSeen: new Date() } }
      );
      
      const sessionRes = await generateSession({ ip, userAgent, userId: findUser._id.toString() });

      if (!sessionRes.isSuccessful) {
        return { status: 400, body: { status: 'failed', message: sessionRes.reason } };
      }

      const access_code = generateJWT({ sessionId: sessionRes.sessionId, type: 'access', userId: findUser._id.toString() });

      return {
        status: 200,
        body: {
          status: 'success',
          message: 'Login successful',
          authUser: findUser,
          accessToken: access_code as string,
          cookie: {
            name: process.env.REFRESH_TOKEN_COOKIE_NAME || 'refresh_token',
            value: sessionRes.token
          }
        },
      };
    }

    return { status: 400, body: { status: 'failed', message: 'Something unexpected happened. Try again later.' } };
  } catch (error) {
    logger.error(`Error on @verifyOtp: ${(error as Error)?.message ?? error}`);
    return { status: 500, body: { status: 'failed', message: 'SERVER_ERROR' } };
  }
};

export const sendResetInstructions = async (
  req: Request<any, any, { email?: string }>
): Promise<{ status: number; body: handleSendResetInstructionsResT }> => {
  try {
    const { email } = req.body || {};

    const safeEmail = sanitizeString(email);
    if (!safeEmail) {
      return { status: 400, body: { status: 'failed', message: 'Email is required' } };
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(safeEmail)) {
      return { status: 400, body: { status: 'failed', message: 'Invalid email format' } };
    }

    const findUser = await User.findOne({ email: safeEmail });
    if (!findUser) {
      // Don't reveal whether email exists — always return success
      return { status: 200, body: { status: 'success', message: 'If that email exists, reset instructions have been sent.' } };
    }

    // #20 Check rate limit first
    const existingOtp = await Otp.findOne({
      accountToVerifyId: findUser._id,
      useCase: 'reset-password',
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });

    if (existingOtp && existingOtp.sendAttempts >= 5) {
      return { status: 429, body: { status: 'failed', message: 'Too many reset instruction requests. Please wait 15 minutes to request another.' } };
    }

    // #20 Delete ALL existing reset OTPs for this user BEFORE creating a new one
    await Otp.deleteMany({ accountToVerifyId: findUser._id, useCase: 'reset-password' });

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    await Otp.create({
      otp: otpCode,
      accountToVerifyId: findUser._id,
      accountType: 'user',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      isUsed: false,
      useCase: 'reset-password',
      sendAttempts: (existingOtp?.sendAttempts ?? 0) + 1,
    });

    const resetLink = `${process.env.FRONTEND_BASE_URL || 'http://localhost:3000'}/auth/change-password/otp?token=${otpCode}`;
    const emailResult = await sendResetPasswordEmail(safeEmail, resetLink);

    if (emailResult === 'error') {
      return { status: 500, body: { status: 'failed', message: 'Failed to send reset instructions. Please try again.' } };
    }

    return { status: 200, body: { status: 'success', message: 'If that email exists, reset instructions have been sent.' } };
  } catch (error) {
    logger.error(`Error on @sendResetInstructions: ${(error as Error)?.message ?? error}`);
    return { status: 500, body: { status: 'failed', message: 'Internal server error' } };
  }
};

export const resetPasswordWithCode = async (
  req: Request<any, any, { code?: string; password?: string; confirmPassword?: string; logoutAllDevices?: boolean }>
): Promise<{ status: number; body: handleResetPasswordWithCodeResT }> => {
  try {
    const { code, password, confirmPassword, logoutAllDevices } = req.body || {};

    const safeCode = sanitizeString(code);
    const safePassword = sanitizeString(password);
    const safeConfirm = sanitizeString(confirmPassword);

    if (!safeCode) {
      return { status: 400, body: { status: 'failed', message: 'Reset code is required' } };
    }
    if (!safePassword) {
      return { status: 400, body: { status: 'failed', message: 'Password is required' } };
    }
    if (!safeConfirm) {
      return { status: 400, body: { status: 'failed', message: 'Password confirmation is required' } };
    }
    if (safePassword.length < 6) {
      return { status: 400, body: { status: 'failed', message: 'Password must be at least 6 characters long' } };
    }
    if (safePassword !== safeConfirm) {
      return { status: 400, body: { status: 'failed', message: 'Passwords do not match' } };
    }

    // #16/#20 Atomic find-and-delete prevents race condition and reuse
    const otpRecord = await Otp.findOneAndDelete({
      otp: safeCode,
      isUsed: false,
      useCase: 'reset-password',
      expiresAt: { $gt: new Date() }, // #25 enforce expiry at DB level
    });

    if (!otpRecord) {
      return { status: 400, body: { status: 'failed', message: 'Invalid or expired reset code' } };
    }

    const user = await User.findById(otpRecord.accountToVerifyId);
    if (!user) {
      return { status: 404, body: { status: 'failed', message: 'User not found' } };
    }

    if (!user.hasOnboarded) {
      return { status: 403, body: { status: 'failed', message: 'This feature is not available for your account. Please complete account setup first.' } };
    }

    const hashedPassword = await bcrypt.hash(safePassword, 10);
    await User.updateOne({ _id: user._id }, { $set: { password: hashedPassword } });

    if (logoutAllDevices) {
      await Session.deleteMany({ userId: user._id });
    }

    return {
      status: 200,
      body: {
        status: 'success',
        message: logoutAllDevices
          ? 'Password has been reset successfully and all devices have been logged out'
          : 'Password has been reset successfully',
      },
    };
  } catch (error) {
    logger.error(`Error on @resetPasswordWithCode: ${(error as Error)?.message ?? error}`);
    return { status: 500, body: { status: 'failed', message: 'Internal server error' } };
  }
};
