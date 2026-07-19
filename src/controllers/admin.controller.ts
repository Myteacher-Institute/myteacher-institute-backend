import { Request, Response } from "express";
import { Admin } from "../models/admin.model";
import bcrypt from "bcryptjs";
import { generateJWTCookie } from "../utils";
import config from "../config/env";
import { AddAdminReqBody, AddAdminResT, AdminLoginReqBody, AdminLoginResT, VerifyAdminOtpReqBody, VerifyAdminOtpResT, ResendAdminOtpReqBody, ResendAdminOtpResT, SendAdminResetCodeReqBody, SendAdminResetCodeResT, ResetAdminPasswordReqBody, ResetAdminPasswordResT } from "../types";
import { adminLoginValidation, verifyAdminOtp, resendAdminOtp, sendAdminResetCode, resetAdminPassword } from "../services/admin.services";
import { sendVerificationEmail, sendAdminWelcomeEmail } from "../services/email.service";
import { createNotification } from "../services/notification.service";

const handleAddAdmin = async (req: Request<AddAdminReqBody>, res: Response<AddAdminResT>) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                status: "failed",
                message: "All fields are required"
            });
        }

        const existingAdmin = await Admin.findOne({ email });

        if (existingAdmin) {
            return res.status(409).json({
                status: "failed",
                message: "Admin with this email already exists"
            });
        }

        const newAdmin = await Admin.create({
            name,
            email,
            password: await bcrypt.hash(password, 10),
            isAdmin: true
        });

        await sendAdminWelcomeEmail({
            name: newAdmin.name,
            email: newAdmin.email,
            password: password
        });

        // Send notification to the new admin
        try {
            await createNotification({
                recipientId: newAdmin._id.toString(),
                recipientType: 'admin',
                title: 'Welcome to Myteacher Institute',
                message: 'Your admin account has been created successfully. You can now manage the platform.',
                type: 'success',
                relatedId: newAdmin._id.toString(),
                relatedType: 'admin'
            });
        } catch (error) {
            console.error('Failed to create notification:', error);
        }

        return res.status(201).json({
            status: "success",
            message: "Admin created successfully",
            admin: {
                name: newAdmin.name,
                email: newAdmin.email,
                isAdmin: newAdmin.isAdmin
            }
        });

    } catch (error) {
        console.error('Add admin error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleAdminLogin = async (req: Request<AdminLoginReqBody>, res: Response<AdminLoginResT>) => {
    try {
        const validation = await adminLoginValidation(req.body);
        if (!validation.isValid) {
            return res.status(401).json({
                status: "failed",
                message: validation.message
            });
        }

        const admin = validation.admin;
        if (!admin) {
            return res.status(401).json({
                status: "failed",
                message: "Invalid credentials"
            });
        }
        const userId = admin._id.toString();

        const emailResult = await sendVerificationEmail(userId, admin.email, 'login', 'admin');

        if (emailResult === 'rate-limited') {
            return res.status(429).json({
                status: "failed",
                message: "Too many login attempts. Please wait 15 minutes before trying again."
            });
        }

        if (emailResult === 'error') {
            return res.status(500).json({
                status: "failed",
                message: "Failed to send verification code. Please try again."
            });
        }

        return res.status(200).json({
            status: "success",
            message: "Verification code sent to your email",
            authUser: {
                name: admin.name,
                email: admin.email,
                isAdmin: admin.isAdmin
            }
        });

    } catch (error) {
        console.error('Admin login error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleVerifyAdminOtp = async (req: Request<VerifyAdminOtpReqBody>, res: Response<VerifyAdminOtpResT>) => {
    try {
        const { otp } = req.body;
        const result = await verifyAdminOtp(otp, req);

        if (!result.success) {
            return res.status(400).json({
                status: "failed",
                message: result.message
            });
        }

        console.log('Admin Login Debug:');
        console.log('- Cookie to set:', result.cookie);
        console.log('- Access Token:', result.accessToken);

        if (result.cookie) {
            res.cookie(result.cookie.name, result.cookie.value, {
                maxAge: 30 * 24 * 60 * 60 * 1000,
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            });
            console.log('- Cookie set successfully');
        }

        return res.status(200).json({
            status: "success",
            message: result.message,
            authUser: result.authUser,
            accessToken: result.accessToken
        });

    } catch (error) {
        console.error('Verify admin OTP error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleResendAdminOtp = async (req: Request<ResendAdminOtpReqBody>, res: Response<ResendAdminOtpResT>) => {
    try {
        const { email } = req.body;
        const result = await resendAdminOtp(email);

        if (!result.success) {
            return res.status(400).json({
                status: "failed",
                message: result.message
            });
        }

        return res.status(200).json({
            status: "success",
            message: result.message
        });

    } catch (error) {
        console.error('Resend admin OTP error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleSendAdminResetCode = async (req: Request<SendAdminResetCodeReqBody>, res: Response<SendAdminResetCodeResT>) => {
    try {
        const { email } = req.body;
        const result = await sendAdminResetCode(email);

        if (!result.success) {
            return res.status(400).json({
                status: "failed",
                message: result.message
            });
        }

        return res.status(200).json({
            status: "success",
            message: result.message
        });

    } catch (error) {
        console.error('Send admin reset code error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleResetAdminPassword = async (req: Request<ResetAdminPasswordReqBody>, res: Response<ResetAdminPasswordResT>) => {
    try {
        const { code, password } = req.body;
        const result = await resetAdminPassword(code, password);

        if (!result.success) {
            return res.status(400).json({
                status: "failed",
                message: result.message
            });
        }

        return res.status(200).json({
            status: "success",
            message: result.message
        });

    } catch (error) {
        console.error('Reset admin password error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

export { handleAddAdmin, handleAdminLogin, handleVerifyAdminOtp, handleResendAdminOtp, handleSendAdminResetCode, handleResetAdminPassword };
