import { Request, Response } from "express";
import { Instructor } from "../models/instructor.model";
import { generateJWTCookie } from "../utils";
import config from "../config/env";
import { 
    InstructorLoginReqBody, 
    InstructorLoginResT, 
    ApplyInstructorReqBody, 
    ApplyInstructorResT, 
    VerifyInstructorResT, 
    VerifyInstructorOtpReqBody,
    VerifyInstructorOtpResT,
    ResendInstructorOtpReqBody,
    ResendInstructorOtpResT,
} from "../types";
import { instructorLoginValidation, applyInstructorValidation, verifyInstructor, verifyInstructorOtp, resendInstructorOtp } from "../services";
import { sendInstructorApplicationEmail, sendVerificationEmail } from "../services/email.service";

const handleInstructorLogin = async (req: Request<InstructorLoginReqBody>, res: Response<InstructorLoginResT>) => {
    try {
        const validation = await instructorLoginValidation(req.body);
        if (!validation.isValid) {
            return res.status(validation.message.includes("verified") ? 403 : 401).json({
                status: "failed",
                message: validation.message
            });
        }

        const instructor = validation.instructor;
        if (!instructor) {
            return res.status(401).json({
                status: "failed",
                message: "Invalid credentials"
            });
        }
        const userId = instructor._id.toString();

        const emailResult = await sendVerificationEmail(userId, instructor.email, 'login');

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
            instructor: {
                name: instructor.name,
                email: instructor.email,
                profilePicture: instructor.profilePicture,
                isVerified: instructor.isVerified
            }
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
        const validation = await applyInstructorValidation(req.body);
        if (!validation.isValid) {
            return res.status(validation.message.includes("already exists") ? 409 : 400).json({
                status: "failed",
                message: validation.message
            });
        }

        const { name, email, phone, profilePicture } = req.body;
        const hashedPassword = validation.hashedPassword;

        const newInstructor = await Instructor.create({
            name,
            email,
            password: hashedPassword,
            phone,
            profilePicture,
            isVerified: false
        });

        await sendInstructorApplicationEmail({ name, email, phone });

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

const handleVerifyInstructor = async (req: Request<{ instructorId: string }>, res: Response<VerifyInstructorResT>) => {
    try {
        const { instructorId } = req.params;
        const result = await verifyInstructor(instructorId);

        if (!result.success) {
            return res.status(result.message?.includes("required") ? 400 : 404).json({
                status: "failed",
                message: result.message || "An error occurred"
            });
        }

        return res.status(200).json({
            status: "success",
            message: result.message || "Instructor verified successfully",
            instructor: result.instructor
        });

    } catch (error) {
        console.error('Verify instructor error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleVerifyInstructorOtp = async (req: Request<VerifyInstructorOtpReqBody>, res: Response<VerifyInstructorOtpResT>) => {
    try {
        const { otp } = req.body;
        const result = await verifyInstructorOtp(otp, req);

        if (!result.success) {
            return res.status(400).json({
                status: "failed",
                message: result.message
            });
        }

        return res.status(200).json({
            status: "success",
            message: result.message,
            instructor: result.instructor,
            accessToken: result.accessToken
        });

    } catch (error) {
        console.error('Verify instructor OTP error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleResendInstructorOtp = async (req: Request<ResendInstructorOtpReqBody>, res: Response<ResendInstructorOtpResT>) => {
    try {
        const { email } = req.body;
        const result = await resendInstructorOtp(email);

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
        console.error('Resend instructor OTP error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

export { handleInstructorLogin, handleApplyAsInstructor, handleVerifyInstructor, handleVerifyInstructorOtp, handleResendInstructorOtp };