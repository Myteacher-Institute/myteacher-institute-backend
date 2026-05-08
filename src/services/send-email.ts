import path from 'path';

import fs from 'fs';
import Otp from '../models/otp.model';
import logger, { resend } from '../utils';
import VerifyAccountEmail from '../templates/emails/verify-account-email';
import ResetPasswordEmail from '../templates/emails/reset-password-instruction';

const logoPath = path.join(process.cwd(), 'src', 'assets', 'logo.png');

// 2. Read the file into a Buffer
const logoBuffer = fs.readFileSync(logoPath);

export const sendVerificationEmail = async (
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

export const sendResetPasswordEmail = async (email: string, resetLink: string) => {
  try {
    const resetPasswordProps = {
      previewText: 'Reset your password',
      logo_url: 'cid:logo_image_id',
      resetLink: resetLink,
    };

    const { data, error } = await resend.emails.send({
      from: process.env.NO_REPLY_EMAIL ?? 'Acme <onboarding@resend.dev>',
      to: email,
      subject: 'Reset Your Password',
      react: ResetPasswordEmail(resetPasswordProps),
      attachments: [
        {
          filename: 'logo.png',
          content: logoBuffer,
          contentId: 'logo_image_id',
        },
      ],
    });

    if (error) {
      logger.error(`Failed to send reset password email to ${email}: ${error.message}`);
      return 'error';
    }

    logger.info(`Reset password email sent to ${email}: ${data?.id}`);
    return 'success';
  } catch (error) {
    logger.error(`Error in sendResetPasswordEmail: ${(error as Error)?.message ?? error}`);
    return 'error';
  }
};
