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
  otpUseCase: 'new-account' | 'onboarded-account' | 'login',
  accountType: 'user' | 'admin' | 'instructor' = 'user'
): Promise<'success' | 'error' | 'rate-limited'> => {
  try {
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    let existingOtp = await Otp.findOne({
      accountToVerifyId: userId,
      accountType: accountType,
      isUsed: false,
    });

    if (existingOtp) {
      if (existingOtp.sendAttempts >= 5) {
        return 'rate-limited';
      }

      existingOtp.otp = otpCode;
      existingOtp.sendAttempts += 1;
      existingOtp.expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      existingOtp.useCase = otpUseCase;
      existingOtp.accountType = accountType;
      await existingOtp.save();
    } else {
      await Otp.create({
        accountToVerifyId: userId,
        otp: otpCode,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        isUsed: false,
        useCase: otpUseCase,
        accountType: accountType,
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

export const sendCoursePurchaseEmail = async (data: {
    email: string;
    name: string;
    courseName: string;
    amount: number;
    currency: string;
    transactionReference: string;
}) => {
    try {
        const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/student`;

        const mailOptions = {
            from: process.env.GMAIL_EMAIL,
            to: data.email,
            subject: `Purchase Confirmed: ${data.courseName}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <img src="cid:logo" alt="Logo" style="max-width: 150px;" />
                    </div>
                    <h2 style="color: #333;">Payment Confirmed</h2>
                    <p style="color: #666;">Hello ${data.name},</p>
                    <p style="color: #666;">Thank you for your purchase. Your payment has been confirmed and you now have full access to your course.</p>
                    <div style="background-color: #f5f5f5; padding: 24px; margin: 24px 0; border-radius: 8px;">
                        <p style="margin: 0 0 6px; font-size: 18px; font-weight: bold; color: #333;">${data.courseName}</p>
                        <p style="margin: 0 0 4px; color: #666;">Amount paid: <strong>${data.currency} ${data.amount}</strong></p>
                        <p style="margin: 0; color: #999; font-size: 12px;">Transaction Reference: ${data.transactionReference}</p>
                    </div>
                    <p style="color: #666;">Start learning right away from your dashboard.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${dashboardUrl}" style="background-color: #223D85; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Go to My Dashboard</a>
                    </div>
                    <p style="color: #999; font-size: 12px;">If you didn't make this purchase, please contact support immediately.</p>
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
        logger.info(`Course purchase email sent successfully to ${data.email}`);
        return 'success';
    } catch (error) {
        logger.error(`Error in sendCoursePurchaseEmail: ${(error as Error)?.message ?? error}`);
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

export const sendAdminWelcomeEmail = async (adminData: { name: string; email: string; password: string }) => {
  try {
    const mailOptions = {
      from: process.env.GMAIL_EMAIL,
      to: adminData.email,
      subject: 'Welcome to MyTeacher Institute - Admin Account Created',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="cid:logo" alt="Logo" style="max-width: 150px;" />
          </div>
          <h2 style="color: #333;">Welcome to MyTeacher Institute</h2>
          <p style="color: #666;">Dear ${adminData.name},</p>
          <p style="color: #666;">Your admin account has been successfully created. You can now access the admin panel to manage the platform.</p>
          <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <p style="margin: 10px 0;"><strong>Email:</strong> ${adminData.email}</p>
          </div>
          <p style="color: #666;">Please log in to your account using the credentials above. We recommend changing your password after your first login.</p>
          <p style="color: #999; font-size: 12px;">If you didn't request this account, please contact support immediately.</p>
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
    logger.info(`Admin welcome email sent successfully to ${adminData.email}`);
    return 'success';
  } catch (error) {
    logger.error(`Error in sendAdminWelcomeEmail: ${(error as Error)?.message ?? error}`);
    return 'error';
  }
};

export const sendAccountDeletionEmail = async (email: string, name: string, code: string) => {
  try {
    const mailOptions = {
      from: process.env.GMAIL_EMAIL,
      to: email,
      subject: 'Account Deletion Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="cid:logo" alt="Logo" style="max-width: 150px;" />
          </div>
          <h2 style="color: #dc2626;">Account Deletion Request</h2>
          <p style="color: #666;">Hello ${name},</p>
          <p style="color: #666;">You have requested to delete your instructor account. This action cannot be undone. Use the following code to confirm account deletion.</p>
          <div style="background-color: #fef2f2; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; color: #dc2626;">
            ${code}
          </div>
          <p style="color: #666;">This code will expire in 10 minutes.</p>
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
    logger.info(`Account deletion email sent successfully to ${email}`);
    return 'success';
  } catch (error) {
    logger.error(`Error in sendAccountDeletionEmail: ${(error as Error)?.message ?? error}`);
    return 'error';
  }
};
