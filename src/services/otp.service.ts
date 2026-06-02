import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { Request } from 'express';

import { User, Otp, Session } from '@/models';
import { generateSession } from './session.service';
import { sendResetPasswordEmail } from './email.service';
import logger, { generateJWT, getClientIp, getHandleVerifyOtpSuccessMessage } from '@/utils';

import {
  handleVerifyOtpResT,
  handleSendResetInstructionsResT,
  handleResetPasswordWithCodeResT,
} from '@/types/auth.types';

export const verifyOtp = async (
  req: Request<any, any, { otp: string }>
): Promise<{ status: number; body: handleVerifyOtpResT }> => {
  try {
    const { otp } = req.body || {};

    if (!otp || typeof otp !== 'string') {
      return { status: 400, body: { status: 'failed', message: 'OTP is required and must be a string' } };
    }

    if (otp.length !== 6) {
      return { status: 400, body: { status: 'failed', message: 'OTP must be exactly 6 digits' } };
    }

    const findOtp = await Otp.findOne({ otp });

    if (!findOtp) {
      return { status: 400, body: { status: 'failed', message: 'The verification code you entered is invalid or has expired. Please request a new one.' } };
    }

    await findOtp.deleteOne();

    const findUser = await User.findById(findOtp.accountToVerifyId);

    if (!findUser) {
      return { status: 400, body: { status: 'failed', message: 'User account not found. Please contact support.' } };
    }

    const ip = getClientIp(req);
    const userAgent = req.get('User-Agent') || '';

    if (findOtp.useCase === 'new-account') {
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
      const sessionRes = await generateSession({ ip, userAgent, userId: findUser._id.toString() });

      if (!sessionRes.isSuccessful) {
        return { status: 400, body: { status: 'failed', message: sessionRes.reason } };
      }

      const access_code = generateJWT({ sessionId: sessionRes.sessionId, type: 'access', userId: findUser._id.toString() });

      return {
        status: 200,
        body: { status: 'success', message: getHandleVerifyOtpSuccessMessage(findOtp.useCase), authUser: findUser, accessToken: access_code as string },
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

    if (!email) {
      return { status: 400, body: { status: 'failed', message: 'Email is required' } };
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return { status: 400, body: { status: 'failed', message: 'Invalid email format' } };
    }

    const findUser = await User.findOne({ email });

    if (!findUser) {
      return { status: 400, body: { status: 'failed', message: 'User account not found. Please contact support.' } };
    }

    const findOtp = await Otp.findOne({ userId: findUser._id, useCase: 'reset-password', isUsed: false });

    if (findOtp) {
      if (findOtp.sendAttempts > 4) {
        return { status: 429, body: { status: 'failed', message: 'Too many reset instruction requests. Please wait 15 minutes to request another.' } };
      }

      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const resetId = new mongoose.Types.ObjectId();

      await Otp.updateOne(
        { _id: findOtp._id },
        { $set: { otp: otpCode, accountToVerifyId: resetId, expiresAt: new Date(Date.now() + 10 * 60 * 1000), sendAttempts: findOtp.sendAttempts + 1 } }
      );

      const resetLink = `${process.env.BACKEND_BASE_URL || 'http://localhost:3000'}/api/auth/therest?token=${otpCode}&id=${encodeURIComponent(resetId.toString())}`;
      const emailResult = await sendResetPasswordEmail(email, resetLink);

      if (emailResult === 'error') {
        return { status: 500, body: { status: 'failed', message: 'Failed to send reset instructions. Please try again.' } };
      }
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    await Otp.create({
      otp: otpCode,
      accountToVerifyId: findUser._id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      isUsed: false,
      useCase: 'reset-password',
      sendAttempts: 1,
    });

    await Otp.deleteMany({ userId: findUser._id, useCase: 'reset-password', isUsed: false });

    const resetLink = `${process.env.FRONTEND_BASE_URL || 'http://localhost:3000'}/auth/change-password/otp?token=${otpCode}`;
    const emailResult = await sendResetPasswordEmail(email, resetLink);

    if (emailResult === 'error') {
      return { status: 500, body: { status: 'failed', message: 'Failed to send reset instructions. Please try again.' } };
    }

    return { status: 200, body: { status: 'success', message: 'Reset instructions sent to your email. Please check your inbox.' } };
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

    if (!code) {
      return { status: 400, body: { status: 'failed', message: 'Reset code is required' } };
    }

    if (!password) {
      return { status: 400, body: { status: 'failed', message: 'Password is required' } };
    }

    if (!confirmPassword) {
      return { status: 400, body: { status: 'failed', message: 'Password confirmation is required' } };
    }

    if (password.length < 6) {
      return { status: 400, body: { status: 'failed', message: 'Password must be at least 6 characters long' } };
    }

    if (password !== confirmPassword) {
      return { status: 400, body: { status: 'failed', message: 'Passwords do not match' } };
    }

    const otpRecord = await Otp.findOne({ otp: code, isUsed: false, useCase: 'reset-password' });

    if (!otpRecord) {
      return { status: 400, body: { status: 'failed', message: 'Invalid or expired reset code' } };
    }

    if (otpRecord.expiresAt < new Date()) {
      return { status: 400, body: { status: 'failed', message: 'Reset code has expired' } };
    }

    const user = await User.findById(otpRecord.accountToVerifyId);

    if (!user) {
      return { status: 404, body: { status: 'failed', message: 'User not found' } };
    }

    if (!user.hasOnboarded) {
      return { status: 403, body: { status: 'failed', message: 'This feature is not available for your account. Please complete account setup first.' } };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.updateOne({ _id: user._id }, { $set: { password: hashedPassword } });
    await Otp.deleteOne({ _id: otpRecord._id });

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
