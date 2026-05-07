import { Request, Response } from 'express';
import User from '../models/user.model';
import Otp from '../models/otp.model';
import { Session } from '../models/session.model';
import logger, { generateJWT, getClientIp, resend } from '../utils';
import VerifyAccountEmail from '../templates/emails/verify-account-email';
import fs from 'fs';
import path from 'path';
import {
  handleAuthenticateResT,
  HandleGetAccessTokenResponseT,
  handleVerifyOtpResT,
  handleVerifyPasswordResT,
} from '../types/auth.controller';
import bcrypt from 'bcryptjs';
import { generateSession } from '../utils/create-session';
import config from '../config/env';
import jwt from 'jsonwebtoken';

// 1. Resolve the path to your file
const logoPath = path.join(process.cwd(), 'src', 'assets', 'logo.png');

// 2. Read the file into a Buffer
const logoBuffer = fs.readFileSync(logoPath);

const sendVerificationEmail = async (
  userId: string,
  email: string,
  otpUseCase: 'new-account' | 'onboarded-account'
): Promise<'success' | 'error' | 'rate-limited'> => {
  try {
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Find existing unused OTP for this user
    let existingOtp = await Otp.findOne({
      accountToVerifyId: userId,
      isUsed: false,
    });

    if (existingOtp) {
      // Check if attempts exceeded 5
      if (existingOtp.sendAttempts >= 5) {
        return 'rate-limited';
      }

      // Update existing OTP with new code and increment attempts
      existingOtp.otp = otpCode;
      existingOtp.sendAttempts += 1;
      // Reset expiry to 10 minutes from now
      existingOtp.expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await existingOtp.save();
    } else {
      // Create new OTP record
      await Otp.create({
        accountToVerifyId: userId,
        otp: otpCode,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        isUsed: false,
        useCase: otpUseCase,
        sendAttempts: 1,
      });
    }

    logger.info(`OTP generated for user ${userId}: ${otpCode}`);

    const verifyAccountProps = {
      previewText: 'Verify your account with your 6-digit code',
      logo_url: 'cid:logo_image_id',
      code: otpCode,
    };

    const { data, error } = await resend.emails.send({
      from: process.env.NO_REPLY_EMAIL ?? 'Acme <onboarding@resend.dev>',
      to: email,
      subject: 'Verify Your Account',
      react: VerifyAccountEmail(verifyAccountProps),
      attachments: [
        {
          filename: 'logo.png',
          content: logoBuffer,
          contentId: 'logo_image_id',
        },
      ],
    });

    if (error) {
      logger.error(`Failed to send verification email to ${email}: ${error.message}`);
      return 'error';
    }

    logger.info(`Email sent successfully. Resend response data: ${JSON.stringify(data)}`);
    return 'success';
  } catch (error) {
    logger.error(`Error in sendVerificationEmail: ${(error as Error)?.message ?? error}`);
    return 'error';
  }
};

export const handleAuthenticateUser = async (
  req: Request<any, any, { email: string }>,
  res: Response<handleAuthenticateResT>
) => {
  try {
    const { email } = req.body;

    if (!email) {
      const errorResponse: handleAuthenticateResT = {
        errorOnInput: true,
        status: 'failed',
        message: 'Email is required',
      };
      return res.status(400).json(errorResponse);
    }

    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
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

const validateVerifyPasswordInput = (
  email: any,
  password: any
): true | handleVerifyPasswordResT => {
  if (typeof email !== 'string') {
    return {
      errorOnInput: 'email',
      status: 'failed',
      message: 'Email must be a string',
    };
  }

  if (!email) {
    return {
      errorOnInput: 'email',
      status: 'failed',
      message: 'Email is required',
    };
  }

  if (typeof password !== 'string') {
    return {
      errorOnInput: 'password',
      status: 'failed',
      message: 'Password must be a string',
    };
  }

  if (!password) {
    return {
      errorOnInput: 'password',
      status: 'failed',
      message: 'Password is required',
    };
  }

  if (password.length < 6) {
    return {
      errorOnInput: 'password',
      status: 'failed',
      message: 'Password must be at least 6 characters long',
    };
  }

  return true;
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

    const getSuccessMessage = (useCase: string): string => {
      if (useCase === 'new-account') {
        return 'Account verified successfully! Welcome aboard.';
      } else if (useCase === 'onboarded-account') {
        return 'Device verified successfully! You can now access your account.';
      }
      return 'Verification successful!';
    };

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
        message: getSuccessMessage(findOtp.useCase),
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
