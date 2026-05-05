import { Request, Response } from 'express';
import User from '../models/user.model';
import logger, { resend } from '../utils';
import Otp from '../models/otp.model';
import VerifyAccountEmail from '../templates/emails/verify-account-email';
import fs from 'fs';
import path from 'path';

// 1. Resolve the path to your file
const logoPath = path.join(process.cwd(), 'src', 'assets', 'logo.png');

// 2. Read the file into a Buffer
const logoBuffer = fs.readFileSync(logoPath);

type handleSignupUserErrorT = {
  errorOnInput: boolean;
  status: 'failed';
  message: string;
};

type handleSignupUserSuccessResT = {
  status: 'success';
  instruction: 'give-code' | 'give-password';
  message: string;
};

type handleSignupUserResT = handleSignupUserErrorT | handleSignupUserSuccessResT;

const sendVerificationEmail = async (
  userId: string,
  email: string
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
        useCase: 'verify-email',
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

export const handleSignupUser = async (
  req: Request<any, any, { email: string }>,
  res: Response<handleSignupUserResT>
) => {
  try {
    const { email } = req.body;

    if (!email) {
      const errorResponse: handleSignupUserErrorT = {
        errorOnInput: true,
        status: 'failed',
        message: 'Email is required',
      };
      return res.status(400).json(errorResponse);
    }

    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!emailRegex.test(email)) {
      const errorResponse: handleSignupUserErrorT = {
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
        const successResponse: handleSignupUserSuccessResT = {
          status: 'success',
          instruction: 'give-password',
          message: 'User onboarded, password required',
        };
        return res.status(200).json(successResponse);
      }

      const emailStatus = await sendVerificationEmail(findUser._id.toString(), findUser.email);

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

      const emailStatus = await sendVerificationEmail(newUser._id.toString(), newUser.email);

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
    console.log('Error on @handleSignupUser. error --> ', (error as Error)?.message ?? error);

    const errorResponse: handleSignupUserErrorT = {
      errorOnInput: false,
      status: 'failed',
      message: 'Internal server error',
    };
    return res.status(500).json(errorResponse);
  }
};
