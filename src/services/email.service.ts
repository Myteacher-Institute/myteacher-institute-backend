import fs from 'fs';
import path from 'path';
import Otp from '../models/otp.model';
import logger from '../utils';
import nodemailer from 'nodemailer';

const logoPath = path.join(process.cwd(), 'src', 'assets', 'logo.png');

const logoBuffer = fs.readFileSync(logoPath);

// Create Gmail transporter using App Password
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_EMAIL,
    pass: process.env.GOOGLE_APP_PASSWORD,
  },
});

export const sendVerificationEmail = async (
  userId: string,
  email: string,
  otpUseCase: 'new-account' | 'onboarded-account' | 'login'
): Promise<'success' | 'error' | 'rate-limited'> => {
  try {
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    let existingOtp = await Otp.findOne({
      accountToVerifyId: userId,
      isUsed: false,
    });

    if (existingOtp) {
      if (existingOtp.sendAttempts >= 5) {
        return 'rate-limited';
      }

      existingOtp.otp = otpCode;
      existingOtp.sendAttempts += 1;
      existingOtp.expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await existingOtp.save();
    } else {
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

    const mailOptions = {
      from: process.env.GMAIL_EMAIL,
      to: email,
      subject: 'Verify Your Account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="cid:logo" alt="Logo" style="max-width: 150px;" />
          </div>
          <h2 style="color: #333;">Verify Your Account</h2>
          <p style="color: #666;">Your verification code is:</p>
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${otpCode}
          </div>
          <p style="color: #666;">This code will expire in 10 minutes.</p>
          <p style="color: #999; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
        </div>
      `,
      attachments: [
        {
          filename: 'logo.png',
          content: logoBuffer,
          cid: 'logo',
        },
      ],
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Verification email sent successfully to ${email}`);
    return 'success';
  } catch (error) {
    logger.error(`Error in sendVerificationEmail: ${(error as Error)?.message ?? error}`);
    return 'error';
  }
};

export const sendResetPasswordEmail = async (email: string, resetLink: string) => {
  try {
    const mailOptions = {
      from: process.env.GMAIL_EMAIL,
      to: email,
      subject: 'Reset Your Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="cid:logo" alt="Logo" style="max-width: 150px;" />
          </div>
          <h2 style="color: #333;">Reset Your Password</h2>
          <p style="color: #666;">Click the button below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #223D85; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
          </div>
          <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
        </div>
      `,
      attachments: [
        {
          filename: 'logo.png',
          content: logoBuffer,
          cid: 'logo',
        },
      ],
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Reset password email sent successfully to ${email}`);
    return 'success';
  } catch (error) {
    logger.error(`Error in sendResetPasswordEmail: ${(error as Error)?.message ?? error}`);
    return 'error';
  }
};

export const sendInstructorApplicationEmail = async (instructorData: { name: string; email: string; phone: string }) => {
  try {
    const mailOptions = {
      from: process.env.GMAIL_EMAIL,
      to: 'myteacheronlineclass1@gmail.com',
      subject: 'New Instructor Application Received',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="cid:logo" alt="Logo" style="max-width: 150px;" />
          </div>
          <h2 style="color: #333;">New Instructor Application</h2>
          <p style="color: #666;">A new instructor has submitted an application. Here are the details:</p>
          <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <p style="margin: 10px 0;"><strong>Name:</strong> ${instructorData.name}</p>
            <p style="margin: 10px 0;"><strong>Email:</strong> ${instructorData.email}</p>
            <p style="margin: 10px 0;"><strong>Phone:</strong> ${instructorData.phone}</p>
          </div>
          <p style="color: #666;">Please review the application and verify the instructor in the admin panel.</p>
        </div>
      `,
      attachments: [
        {
          filename: 'logo.png',
          content: logoBuffer,
          cid: 'logo',
        },
      ],
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Instructor application email sent successfully for ${instructorData.email}`);
    return 'success';
  } catch (error) {
    logger.error(`Error in sendInstructorApplicationEmail: ${(error as Error)?.message ?? error}`);
    return 'error';
  }
};
