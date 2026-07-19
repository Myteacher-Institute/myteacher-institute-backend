import { Admin } from "../models/admin.model";
import bcrypt from "bcryptjs";
import Otp from "../models/otp.model";
import { generateSession } from "./session.service";
import { generateJWT, getClientIp, sanitizeString } from "../utils";
import { sendVerificationEmail } from "./email.service";
import { sendResetPasswordEmail } from "./email.service";
import { createNotification } from "./notification.service";

const adminLoginValidation = async (payload: { email?: string; password?: string }) => {
    // #10/#22 sanitize inputs
    const email = sanitizeString(payload.email);
    const password = sanitizeString(payload.password);

    if (!email || !password) {
        return { isValid: false, message: "Email and password are required" };
    }

    const admin = await Admin.findOne({ email });
    if (!admin) {
        return { isValid: false, message: "Invalid credentials" };
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
        return { isValid: false, message: "Invalid credentials" };
    }

    return { isValid: true, message: "Validation passed", admin };
};

const verifyAdminOtp = async (otp: string, req: any) => {
    console.log('verifyAdminOtp called with OTP:', otp);

    if (!otp || typeof otp !== 'string') {
        console.log('OTP validation failed: not a string');
        return {
            success: false,
            message: 'OTP is required and must be a string'
        };
    }

    if (otp.length !== 6) {
        console.log('OTP validation failed: not 6 digits');
        return {
            success: false,
            message: 'OTP must be exactly 6 digits'
        };
    }

    // #16 Atomic find-and-delete prevents race condition / OTP reuse
    // #25 expiresAt check enforced at DB query level
    const findOtp = await Otp.findOneAndDelete({
      otp,
      accountType: 'admin',
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });

    console.log('Found OTP record:', findOtp ? {
        _id: findOtp._id,
        otp: findOtp.otp,
        accountToVerifyId: findOtp.accountToVerifyId,
        accountType: findOtp.accountType,
        useCase: findOtp.useCase,
        isUsed: findOtp.isUsed,
        expiresAt: findOtp.expiresAt,
    } : 'null');

    if (!findOtp) {
        return {
            success: false,
            message: 'The verification code you entered is invalid or has expired. Please request a new one.'
        };
    }

    const findAdmin = await Admin.findById(findOtp.accountToVerifyId);

    if (!findAdmin) {
        return {
            success: false,
            message: 'Admin account not found. Please contact support.'
        };
    }

    const ip = getClientIp(req);
    const userAgent = req.get('User-Agent') || '';

    if (findOtp.useCase === 'login') {
        // Ensure online status fields exist
        const { ensureOnlineStatusFields } = await import('./user-status.service');
        await ensureOnlineStatusFields(findAdmin._id.toString(), 'admin');
        
        // Set admin as online
        await Admin.updateOne(
            { _id: findAdmin._id },
            { $set: { isOnline: true, lastSeen: new Date() } }
        );
        
        const sessionRes = await generateSession({ ip, userAgent, userId: findAdmin._id.toString() });

        if (!sessionRes.isSuccessful) {
            return {
                success: false,
                message: sessionRes.reason
            };
        }

        const access_code = generateJWT({ sessionId: sessionRes.sessionId, type: 'access', userId: findAdmin._id.toString() });

        return {
            success: true,
            message: 'Login successful',
            authUser: {
                name: findAdmin.name,
                email: findAdmin.email,
                isAdmin: findAdmin.isAdmin
            },
            accessToken: access_code as string,
            cookie: {
                name: process.env.REFRESH_TOKEN_COOKIE_NAME || 'refresh_token',
                value: sessionRes.token
            }
        };
    }

    return {
        success: false,
        message: 'Something unexpected happened. Try again later.'
    };
};

const resendAdminOtp = async (email: string) => {
    const safeEmail = sanitizeString(email);
    if (!safeEmail) {
        return { success: false, message: 'Email is required' };
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(safeEmail)) {
        return { success: false, message: 'Invalid email format' };
    }

    const admin = await Admin.findOne({ email: safeEmail });
    if (!admin) {
        return { success: false, message: 'Admin not found' };
    }

    const emailStatus = await sendVerificationEmail(admin._id.toString(), admin.email, 'login', 'admin');

    if (emailStatus === 'rate-limited') {
        return { success: false, message: 'Too many attempts. Please wait 15 minutes to request another code.' };
    }
    if (emailStatus === 'error') {
        return { success: false, message: 'Failed to send verification email. Please try again.' };
    }

    return { success: true, message: 'OTP code has been resent to your email.' };
};

const sendAdminResetCode = async (email: string) => {
    if (!email) {
        return {
            success: false,
            message: 'Email is required'
        };
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
        return {
            success: false,
            message: 'Invalid email format'
        };
    }

    const admin = await Admin.findOne({ email });

    if (!admin) {
        return {
            success: false,
            message: 'Admin not found'
        };
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetTokenExpiry = new Date(Date.now() + 10 * 60 * 1000);

    admin.resetPasswordToken = resetCode;
    admin.resetPasswordExpiry = resetTokenExpiry;
    await admin.save();

    const resetLink = `${process.env.FRONTEND_BASE_URL || 'http://localhost:3000'}/auth/reset-password?token=${resetCode}`;
    const emailResult = await sendResetPasswordEmail(email, resetLink);

    if (emailResult === 'error') {
        return {
            success: false,
            message: 'Failed to send reset email. Please try again.'
        };
    }

    return {
        success: true,
        message: 'Password reset code sent successfully'
    };
};

const resetAdminPassword = async (code: string, password: string) => {
    if (!code || !password) {
        return {
            success: false,
            message: 'Code and password are required'
        };
    }

    const admin = await Admin.findOne({ resetPasswordToken: code });

    if (!admin) {
        return {
            success: false,
            message: 'Invalid or expired reset code'
        };
    }

    if (admin.resetPasswordExpiry && admin.resetPasswordExpiry < new Date()) {
        return {
            success: false,
            message: 'Reset code has expired'
        };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    admin.password = hashedPassword;
    admin.resetPasswordToken = undefined;
    admin.resetPasswordExpiry = undefined;
    await admin.save();

    return {
        success: true,
        message: 'Password reset successfully'
    };
};

export { adminLoginValidation, verifyAdminOtp, resendAdminOtp, sendAdminResetCode, resetAdminPassword };
