import { Request, Response } from 'express';
import User from '../models/user.model';
import Otp from '../models/otp.model';
import { Session } from '../models/session.model';
import { generateJWT, getClientIp, getHandleVerifyOtpSuccessMessage, validateVerifyPasswordInput } from '../utils';

import {
  handleAuthenticateResT,
  HandleGetAccessTokenResponseT,
  handleResetPasswordWithCodeResT,
  handleSendResetInstructionsResT,
  handleVerifyOtpResT,
  handleVerifyPasswordResT,
} from '../types/controller/auth.types';
import bcrypt from 'bcryptjs';
import { generateSession } from '../utils/create-session';
import config from '../config/env';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { sendResetPasswordEmail, sendVerificationEmail } from '../services/send-email';




export const handleAuthenticateUser = async (
  req: Request<any, any, { email: string }>,
  res: Response<handleAuthenticateResT>
) => {
  try {
    const { email } = req.body || {};

    if (!email) {
      const errorResponse: handleAuthenticateResT = {
        errorOnInput: true,
        status: 'failed',
        message: 'Email is required',
      };
      return res.status(400).json(errorResponse);
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      const errorResponse: handleAuthenticateResT = {
        errorOnInput: true,
        status: 'failed',
        message: 'Invalid email format',
      };
      return res.status(400).json(errorResponse);
    }

    const findUser = await User.findOne({
      email,
    });

    if (findUser) {
      // User Onboarded make them give password
      if (findUser.hasOnboarded) {
        const successResponse: handleAuthenticateResT = {
          status: 'success',
          instruction: 'give-password',
          message: 'User onboarded, password required',
        };
        return res.status(200).json(successResponse);
      }

      const emailStatus = await sendVerificationEmail(
        findUser._id.toString(),
        findUser.email,
        'new-account'
      );

      if (emailStatus === 'rate-limited') {
        return res.status(429).json({
          errorOnInput: false,
          message: 'Too many attempts. Please wait 15 minutes to request another code.',
          status: 'failed',
        });
      }

      if (emailStatus === 'error') {
        return res.status(500).json({
          errorOnInput: false,
          message: 'Failed to send verification email. Please try again.',
          status: 'failed',
        });
      }

      return res.status(200).json({
        status: 'success',
        instruction: 'give-code',
        message: 'An OTP code has been sent to your email. Please verify to continue.',
      });
    } else {
      const newUser = await User.create({
        email,
      });

      const emailStatus = await sendVerificationEmail(
        newUser._id.toString(),
        newUser.email,
        'new-account'
      );

      if (emailStatus === 'rate-limited') {
        return res.status(429).json({
          errorOnInput: false,
          message: 'Too many attempts. Please wait 15 minutes to request another code.',
          status: 'failed',
        });
      }

      if (emailStatus === 'error') {
        return res.status(500).json({
          errorOnInput: false,
          message: 'Failed to send verification email. Please try again.',
          status: 'failed',
        });
      }

      return res.status(200).json({
        status: 'success',
        instruction: 'give-code',
        message: 'An OTP code has been sent to your email. Please verify to continue.',
      });
    }
  } catch (error) {
    console.log('Error on @handleAuthenticateUser. error --> ', (error as Error)?.message ?? error);

    const errorResponse: handleAuthenticateResT = {
      errorOnInput: false,
      status: 'failed',
      message: 'Internal server error',
    };
    return res.status(500).json(errorResponse);
  }
};


export const handleVerifyPassword = async (
  req: Request<any, any, { password?: string; email?: string }>,
  res: Response<handleVerifyPasswordResT>
) => {
  try {
    const { email, password } = req.body;

    const validationResult = validateVerifyPasswordInput(email, password);
    if (validationResult !== true) {
      return res.status(400).json(validationResult);
    }

    const findUser = await User.findOne({ email });

    if (!findUser || !findUser.hasOnboarded) {
      // User isn't supposed to be here. If we didn't direct them properly, they might be trying to access an endpoint that doesn't exist for their case.
      const errorResponse: handleVerifyPasswordResT = {
        errorOnInput: false,
        status: 'failed',
        message: 'Wrong endpoint. Please contact support.',
      };
      return res.status(404).json(errorResponse);
    }

    const isPasswordCorrect = await bcrypt.compare(password!, findUser.password);

    if (!isPasswordCorrect) {
      const errorResponse: handleVerifyPasswordResT = {
        errorOnInput: 'password',
        status: 'failed',
        message: 'The password you entered is incorrect. Please try again.',
      };
      return res.status(400).json(errorResponse);
    }

    const userIp = getClientIp(req);
    const userAgent = req.get('User-Agent') || '';

    // Check if this device is trusted and hasn't been locked out
    const trustedSession = await Session.findOne({
      userId: findUser._id,
      ip: userIp,
      userAgent: userAgent,
      isRevoked: false,
    });

    if (trustedSession) {
      // Device is trusted - generate session and return access code
      const sessionResult = await generateSession({
        ip: userIp,
        userAgent: userAgent,
        userId: findUser._id.toString(),
      });

      if (sessionResult.isSuccessful) {
        const cookieName = config['REFRESH_TOKEN_COOKIE_NAME'];

        res.cookie(cookieName, sessionResult.token, {
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'none',
        });

        const access_code = generateJWT({
          sessionId: sessionResult.sessionId,
          type: 'access',
          userId: findUser._id.toString(),
        });

        const successResponse: handleVerifyPasswordResT = {
          status: 'success',
          isTrusted: true,
          message: 'Welcome back! You have successfully logged in to your account.',
          access_code,
        };
        return res.status(200).json(successResponse);
      } else {
        const errorResponse: handleVerifyPasswordResT = {
          errorOnInput: false,
          status: 'failed',
          message: 'Something unexpected happened. Please try again.',
        };
        return res.status(500).json(errorResponse);
      }
    } else {
      // New device - send OTP for verification
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      await Otp.create({
        accountToVerifyId: findUser._id,
        otp: otpCode,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        isUsed: false,
        useCase: 'onboarded-account',
      });

      const successResponse: handleVerifyPasswordResT = {
        status: 'success',
        isTrusted: false,
        isGiveCode: true,
        isCompleted: false,
        message: 'New device detected. Please verify with the code sent to your email.',
      };
      return res.status(200).json(successResponse);
    }
  } catch (error) {
    console.log('Error on @handleVerifyPassword. error --> ', (error as Error)?.message ?? error);
  }
};

export const handleVerifyOtp = async (
  req: Request<any, any, { otp: string }>,
  res: Response<handleVerifyOtpResT>
) => {
  try {
    const { otp } = req.body || {};

    // Validate OTP
    if (!otp || typeof otp !== 'string') {
      return res.status(400).json({
        message: 'OTP is required and must be a string',
        status: 'failed',
      });
    }

    if (otp.length !== 6) {
      return res.status(400).json({
        message: 'OTP must be exactly 6 digits',
        status: 'failed',
      });
    }

    const findOtp = await Otp.findOne({
      otp,
    });

    if (!findOtp) {
      return res.status(400).json({
        message:
          'The verification code you entered is invalid or has expired. Please request a new one.',
        status: 'failed',
      });
    }

    const findUser = await User.findById(findOtp.accountToVerifyId);

    if (!findUser) {
      return res.status(400).json({
        message: 'User account not found. Please contact support.',
        status: 'failed',
      });
    }

    const ip = getClientIp(req);
    const userAgent = req.get('User-Agent') || '';



    if (findOtp.useCase === 'new-account' || findOtp.useCase === 'onboarded-account') {
      const sessionRes = await generateSession({
        ip,
        userAgent,
        userId: findUser._id.toString(),
      });

      if (!sessionRes.isSuccessful) {
        return res.status(500).json({
          message: 'We encountered an issue setting up your session. Please try again.',
          status: 'failed',
        });
      }

      const access_code = generateJWT({
        sessionId: sessionRes.sessionId,
        type: 'access',
        userId: findUser._id.toString(),
      });

      return res.status(200).json({
        status: 'success',
        message: getHandleVerifyOtpSuccessMessage(findOtp.useCase),
        authUser: findUser,
        accessToken: access_code,
      });
    }

    return res.status(400).json({
      message: 'Something unexpected happened. Try again later. ',
      status: 'failed',
    });
  } catch (error) {
    console.error('Error on handleVerifyOtp error --->', (error as Error)?.message ?? error);
    res.status(500).json({ message: 'SERVER_ERROR', status: 'failed' });
  }
};

export const handleGetAccessToken = (
  req: Request,
  res: Response<HandleGetAccessTokenResponseT>
) => {
  try {
    const refreshCookieName = config['REFRESH_TOKEN_COOKIE_NAME'];
    const refreshTokenSecret = config['JWT_REFRESH_TOKEN_SECRET'];

    const cookies = req.cookies;

    const refreshCookie = cookies[refreshCookieName];

    if (!refreshCookie) {
      return res.status(401).json({
        type: 'no-refresh',
        message: 'No refresh token found. Please log in again.',
      });
    }

    try {
      const decoded = jwt.verify(refreshCookie, refreshTokenSecret) as {
        userId: string;
        sessionId: string;
      };

      const newAccessToken = generateJWT({
        userId: decoded.userId,
        type: 'access',
        sessionId: decoded.sessionId,
      });

      return res.status(200).json({
        type: 'success',
        message: 'Access token generated successfully',
        accessToken: newAccessToken,
      });
    } catch {
      return res.status(401).json({
        type: 'invalid-refresh',
        message: 'Invalid or expired refresh token. Please log in again.',
      });
    }
  } catch (error) {
    console.log('Error on @handleGetAccessToken. error --> ', (error as Error)?.message ?? error);
    res.status(500).json({ type: 'server-error', message: 'Internal server error occurred' });
  }
};

export const handleSendResetInstructions = async (
  req: Request<any, any, { email?: string }>,
  res: Response<handleSendResetInstructionsResT>
) => {
  try {
    const { email } = req.body || {};

    // Validate email
    if (!email) {
      const errorResponse: handleSendResetInstructionsResT = {
        status: 'failed',
        message: 'Email is required',
      };
      return res.status(400).json(errorResponse);
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      const errorResponse: handleSendResetInstructionsResT = {
        status: 'failed',
        message: 'Invalid email format',
      };
      return res.status(400).json(errorResponse);
    }

    // Find user
    const findUser = await User.findOne({ email });

    if (!findUser) {
      const errorResponse: handleSendResetInstructionsResT = {
        status: 'failed',
        message: 'User account not found. Please contact support.',
      };
      return res.status(400).json(errorResponse);
    }

    const findOtp = await Otp.findOne({
      userId: findUser._id,
      useCase: 'reset-password',
      isUsed: false,
    });

    if (findOtp) {
      if (findOtp.sendAttempts > 4) {
        const errorResponse: handleSendResetInstructionsResT = {
          status: 'failed',
          message:
            'Too many reset instruction requests. Please wait 15 minutes to request another.',
        };
        return res.status(429).json(errorResponse);
      }

      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

      const resetId = new mongoose.Types.ObjectId();

      // Update existing OTP with new code and reset ID
      await Otp.updateOne(
        { _id: findOtp._id },
        {
          $set: {
            otp: otpCode,
            accountToVerifyId: resetId,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
            sendAttempts: findOtp.sendAttempts + 1,
          },
        }
      );

      // Send reset password email
      const resetLink = `${process.env.BACKEND_BASE_URL || 'http://localhost:3000'}/api/auth/therest?token=${otpCode}&id=${encodeURIComponent(resetId.toString())}`;
      const emailResult = await sendResetPasswordEmail(email, resetLink);

      if (emailResult === 'error') {
        const errorResponse: handleSendResetInstructionsResT = {
          status: 'failed',
          message: 'Failed to send reset instructions. Please try again.',
        };
        return res.status(500).json(errorResponse);
      }
    }

    // Create new OTP for first-time reset request
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Create new OTP record
    await Otp.create({
      otp: otpCode,
      accountToVerifyId: findUser._id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      isUsed: false,
      useCase: 'reset-password',
      sendAttempts: 1,
    });

    // Delete old OTP records for this user and use case
    await Otp.deleteMany({
      userId: findUser._id,
      useCase: 'reset-password',
      isUsed: false,
    });

    // Send reset password email
    const resetLink = `${process.env.FRONTEND_BASE_URL || 'http://localhost:3000'}/auth/change-password/otp?token=${otpCode}`;
    const emailResult = await sendResetPasswordEmail(email, resetLink);

    if (emailResult === 'error') {
      const errorResponse: handleSendResetInstructionsResT = {
        status: 'failed',
        message: 'Failed to send reset instructions. Please try again.',
      };
      return res.status(500).json(errorResponse);
    }

    // Return success response after email is sent
    const successResponse: handleSendResetInstructionsResT = {
      status: 'success',
      message: 'Reset instructions sent to your email. Please check your inbox.',
    };
    return res.status(200).json(successResponse);
  } catch (error) {
    console.log(
      'Error on @handleSendResetInstructions. error --> ',
      (error as Error)?.message ?? error
    );
    const errorResponse: handleSendResetInstructionsResT = {
      status: 'failed',
      message: 'Internal server error',
    };
    return res.status(500).json(errorResponse);
  }
};

export const handleResetPasswordWithCode = async (
  req: Request<any, any, { code?: string; password?: string; confirmPassword?: string; logoutAllDevices?: boolean }>,
  res: Response<handleResetPasswordWithCodeResT>
) => {
  try {
    const { code, password, confirmPassword, logoutAllDevices } = req.body || {};

    // Validate required fields
    if (!code) {
      const errorResponse: handleResetPasswordWithCodeResT = {
        status: 'failed',
        message: 'Reset code is required',
      };
      return res.status(400).json(errorResponse);
    }

    if (!password) {
      const errorResponse: handleResetPasswordWithCodeResT = {
        status: 'failed',
        message: 'Password is required',
      };
      return res.status(400).json(errorResponse);
    }

    if (!confirmPassword) {
      const errorResponse: handleResetPasswordWithCodeResT = {
        status: 'failed',
        message: 'Password confirmation is required',
      };
      return res.status(400).json(errorResponse);
    }

    // Validate password strength
    if (password.length < 6) {
      const errorResponse: handleResetPasswordWithCodeResT = {
        status: 'failed',
        message: 'Password must be at least 6 characters long',
      };
      return res.status(400).json(errorResponse);
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      const errorResponse: handleResetPasswordWithCodeResT = {
        status: 'failed',
        message: 'Passwords do not match',
      };
      return res.status(400).json(errorResponse);
    }

    // Find OTP record
    const otpRecord = await Otp.findOne({
      otp: code,
      isUsed: false,
      useCase: 'reset-password',
    });

    if (!otpRecord) {
      const errorResponse: handleResetPasswordWithCodeResT = {
        status: 'failed',
        message: 'Invalid or expired reset code',
      };
      return res.status(400).json(errorResponse);
    }

    // Check if OTP has expired
    if (otpRecord.expiresAt < new Date()) {
      const errorResponse: handleResetPasswordWithCodeResT = {
        status: 'failed',
        message: 'Reset code has expired',
      };
      return res.status(400).json(errorResponse);
    }

    // Find the user associated with this OTP
    const user = await User.findById(otpRecord.accountToVerifyId);
    if (!user) {
      const errorResponse: handleResetPasswordWithCodeResT = {
        status: 'failed',
        message: 'User not found',
      };
      return res.status(404).json(errorResponse);
    }

    // Check if user is onboarded
    if (!user.hasOnboarded) {
      const errorResponse: handleResetPasswordWithCodeResT = {
        status: 'failed',
        message: 'This feature is not available for your account. Please complete account setup first.',
      };
      return res.status(403).json(errorResponse);
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user password
    await User.updateOne(
      { _id: user._id },
      { $set: { password: hashedPassword } }
    );

    // Delete OTP record
    await Otp.deleteOne({ _id: otpRecord._id });

    // Logout all devices if requested
    if (logoutAllDevices) {
      await Session.deleteMany({ userId: user._id });
    }

    const successResponse: handleResetPasswordWithCodeResT = {
      status: 'success',
      message: logoutAllDevices
        ? 'Password has been reset successfully and all devices have been logged out'
        : 'Password has been reset successfully',
    };
    return res.status(200).json(successResponse);


  } catch (error) {
    console.log(
      'Error on @handleResetPasswordWithCode. error --> ',
      (error as Error)?.message ?? error
    );
    const errorResponse: handleResetPasswordWithCodeResT = {
      status: 'failed',
      message: 'Internal server error',
    };
    res.status(500).json(errorResponse);
  }
};
