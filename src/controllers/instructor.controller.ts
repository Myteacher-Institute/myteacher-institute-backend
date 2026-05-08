import { Request, Response } from "express";
import { Instructor } from "../models/instructor.model";
import bcrypt from "bcryptjs";
import { generateJWTCookie } from "../utils";
import config from "../config/env";
import { InstructorLoginReqBody, InstructorLoginResT, ApplyInstructorReqBody, ApplyInstructorResT, GetAllInstructorsResT, RejectInstructorResT, VerifyInstructorResT, GetInstructorByIdResT, DeleteInstructorResT, UpdateInstructorResT, ResetPasswordReqBody, ResetPasswordResT, SendResetPasswordCodeReqBody, SendResetPasswordCodeResT } from "../types/instructor.type";
import { Resend } from "resend";
import PasswordResetRequestEmail from "../templates/emails/password-reset-request";
import PasswordResetCodeEmail from "../templates/emails/password-reset-code";

const handleInstructorLogin = async (req: Request<InstructorLoginReqBody>, res: Response<InstructorLoginResT>) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                status: "failed",
                message: "Email and password are required"
            });
        }

        const instructor = await Instructor.findOne({ email });

        if (!instructor) {
            return res.status(401).json({
                status: "failed",
                message: "Invalid credentials"
            });
        }

        if (!instructor.isVerified) {
            return res.status(403).json({
                status: "failed",
                message: "Instructor account is not verified"
            });
        }

        const isPasswordValid = await bcrypt.compare(password, instructor.password);

        if (!isPasswordValid) {
            return res.status(401).json({
                status: "failed",
                message: "Invalid credentials"
            });
        }

        const userId = instructor._id.toString();

        const refreshToken = await generateJWTCookie({
            type: "refresh",
            userId,
        });

        const accessToken = await generateJWTCookie({
            type: "access",
            userId,
        });

        if (refreshToken === "error" || accessToken === "error") {
            return res.status(500).json({
                status: "failed",
                message: "Something unexpected happened, try again"
            });
        }

        const REFRESH_TOKEN_COOKIE_NAME = config["REFRESH_TOKEN_COOKIE_NAME"];

        res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken);

        return res.status(200).json({
            status: "success",
            message: "Login successful",
            instructor: {
                name: instructor.name,
                email: instructor.email,
                profilePicture: instructor.profilePicture,
                isVerified: instructor.isVerified
            },
            accessToken
        });

    } catch (error) {
        console.error('Instructor login error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleApplyAsInstructor = async (req: Request<ApplyInstructorReqBody>, res: Response<ApplyInstructorResT>) => {
    try {
        const { name, email, password, phone, profilePicture } = req.body;

        if (!name || !email || !password || !phone || !profilePicture) {
            return res.status(400).json({
                status: "failed",
                message: "All fields are required"
            });
        }

        const existingInstructor = await Instructor.findOne({ email });

        if (existingInstructor) {
            return res.status(409).json({
                status: "failed",
                message: "Instructor with this email already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newInstructor = await Instructor.create({
            name,
            email,
            password: hashedPassword,
            phone,
            profilePicture,
            isVerified: false
        });

        return res.status(201).json({
            status: "success",
            message: "Instructor application submitted successfully",
            instructor: {
                name: newInstructor.name,
                email: newInstructor.email,
                isVerified: newInstructor.isVerified
            }
        });

    } catch (error) {
        console.error('Apply as instructor error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleVerifyInstructor = async (req: Request, res: Response<VerifyInstructorResT>) => {
    try {
        const { instructorId } = req.params;

        if (!instructorId) {
            return res.status(400).json({
                status: "failed",
                message: "Instructor ID is required"
            });
        }

        const instructor = await Instructor.findByIdAndUpdate(
            instructorId,
            { isVerified: true },
            { new: true }
        );

        if (!instructor) {
            return res.status(404).json({
                status: "failed",
                message: "Instructor not found"
            });
        }

        return res.status(200).json({
            status: "success",
            message: "Instructor verified successfully",
            instructor: {
                name: instructor.name,
                email: instructor.email,
                isVerified: instructor.isVerified
            }
        });

    } catch (error) {
        console.error('Verify instructor error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleSendResetPasswordCode = async (req: Request<SendResetPasswordCodeReqBody>, res: Response<SendResetPasswordCodeResT>) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                status: "failed",
                message: "Email is required"
            });
        }

        const instructor = await Instructor.findOne({ email });

        if (!instructor) {
            return res.status(404).json({
                status: "failed",
                message: "Instructor not found"
            });
        }

        // Generate reset code (6-digit OTP)
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        const resetTokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        instructor.resetPasswordToken = resetCode;
        instructor.resetPasswordExpiry = resetTokenExpiry;
        await instructor.save();

        // Send reset email
        const passwordResetProps = {
            previewText: "Reset your password with your 6-digit code",
            logo_url: "https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/light/notion.png",
            username: instructor.name,
            code: resetCode
        }

        const resend = new Resend(process.env.RESEND_API_KEY);
        const { data, error } = await resend.emails.send({
            from: process.env.RESEND_EMAIL_SENDER || "Acme <onboarding@resend.dev>",
            to: [instructor.email],
            subject: "Password Reset Request",
            react: PasswordResetRequestEmail(passwordResetProps)
        });

        if (error) {
            console.error('Email sending error --->', error);
            return res.status(500).json({
                status: "failed",
                message: "Failed to send reset email"
            });
        }

        return res.status(200).json({
            status: "success",
            message: "Password reset code sent successfully"
        });

    } catch (error) {
        console.error('Send reset password code error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleResetPassword = async (req: Request<ResetPasswordReqBody>, res: Response<ResetPasswordResT>) => {
    try {
        const { code, password } = req.body;

        if (!code || !password) {
            return res.status(400).json({
                status: "failed",
                message: "Code and password are required"
            });
        }

        const instructor = await Instructor.findOne({ resetPasswordToken: code });

        if (!instructor) {
            return res.status(404).json({
                status: "failed",
                message: "Invalid or expired reset code"
            });
        }

        // Check if token has expired
        if (instructor.resetPasswordExpiry && instructor.resetPasswordExpiry < new Date()) {
            return res.status(400).json({
                status: "failed",
                message: "Reset code has expired"
            });
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update password and clear reset token
        instructor.password = hashedPassword;
        instructor.resetPasswordToken = undefined;
        instructor.resetPasswordExpiry = undefined;
        await instructor.save();

        return res.status(200).json({
            status: "success",
            message: "Password reset successfully"
        });

    } catch (error) {
        console.error('Reset password error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleResendResetPassword = async (req: Request, res: Response<SendResetPasswordCodeResT>) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                status: "failed",
                message: "Email is required"
            });
        }

        const instructor = await Instructor.findOne({ email });

        if (!instructor) {
            return res.status(404).json({
                status: "failed",
                message: "Instructor not found"
            });
        }

        // Generate new reset code (6-digit OTP)
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        const resetExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        instructor.resetPasswordToken = resetCode;
        instructor.resetPasswordExpiry = resetExpiry;
        await instructor.save();

        // Send reset code to email
        const passwordResetProps = {
            previewText: "Your password reset code",
            logo_url: "https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/light/notion.png",
            username: instructor.name,
            code: resetCode
        }

        const resend = new Resend(process.env.RESEND_API_KEY);
        const { data, error } = await resend.emails.send({
            from: process.env.RESEND_EMAIL_SENDER || "Acme <onboarding@resend.dev>",
            to: [instructor.email],
            subject: "Password Reset Code",
            react: PasswordResetCodeEmail(passwordResetProps)
        });

        if (error) {
            console.error('Email sending error --->', error);
            return res.status(500).json({
                status: "failed",
                message: "Failed to send reset email"
            });
        }

        return res.status(200).json({
            status: "success",
            message: "Reset code sent successfully"
        });

    } catch (error) {
        console.error('Resend reset code error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};


// this are other routes

const handleRejectInstructor = async (req: Request, res: Response<RejectInstructorResT>) => {
    try {
        const { instructorId } = req.params;

        if (!instructorId) {
            return res.status(400).json({
                status: "failed",
                message: "Instructor ID is required"
            });
        }

        const instructor = await Instructor.findByIdAndDelete(instructorId);

        if (!instructor) {
            return res.status(404).json({
                status: "failed",
                message: "Instructor not found"
            });
        }

        return res.status(200).json({
            status: "success",
            message: "Instructor rejected successfully"
        });

    } catch (error) {
        console.error('Reject instructor error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleGetAllInstructors = async (req: Request, res: Response<GetAllInstructorsResT>) => {
    try {
        const instructors = await Instructor.find();
        return res.status(200).json({
            status: "success",
            instructors
        });
    } catch (error) {
        console.error('Get all instructors error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleGetInstructorById = async (req: Request, res: Response<GetInstructorByIdResT>) => {
    try {
        const { instructorId } = req.params;

        if (!instructorId) {
            return res.status(400).json({
                status: "failed",
                message: "Instructor ID is required"
            });
        }

        const instructor = await Instructor.findById(instructorId);

        if (!instructor) {
            return res.status(404).json({
                status: "failed",
                message: "Instructor not found"
            });
        }

        return res.status(200).json({
            status: "success",
            instructor
        });

    } catch (error) {
        console.error('Get instructor by id error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleDeleteInstructor = async (req: Request<{ instructorId: string }>, res: Response<DeleteInstructorResT>) => {
    try {
        const { instructorId } = req.params;

        if (!instructorId) {
            return res.status(400).json({
                status: "failed",
                message: "Instructor ID is required"
            });
        }

        const instructor = await Instructor.findByIdAndDelete(instructorId);

        if (!instructor) {
            return res.status(404).json({
                status: "failed",
                message: "Instructor not found"
            });
        }

        return res.status(200).json({
            status: "success",
            message: "Instructor deleted successfully"
        });

    } catch (error) {
        console.error('Delete instructor error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleUpdateInstructor = async (req: Request<{ instructorId: string }>, res: Response<UpdateInstructorResT>) => {
    try {
        const { instructorId } = req.params;
        const { name, email, password } = req.body;

        if (!instructorId) {
            return res.status(400).json({
                status: "failed",
                message: "Instructor ID is required"
            });
        }

        const updateData: any = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (password) updateData.password = await bcrypt.hash(password, 10);

        const instructor = await Instructor.findByIdAndUpdate(instructorId, updateData, { new: true });

        if (!instructor) {
            return res.status(404).json({
                status: "failed",
                message: "Instructor not found"
            });
        }

        return res.status(200).json({
            status: "success",
            message: "Instructor updated successfully",
            instructor
        });

    } catch (error) {
        console.error('Update instructor error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

export { handleInstructorLogin, handleApplyAsInstructor, handleVerifyInstructor, handleSendResetPasswordCode, handleResetPassword, handleResendResetPassword, handleRejectInstructor, handleGetAllInstructors, handleGetInstructorById, handleDeleteInstructor, handleUpdateInstructor };