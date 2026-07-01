import { Instructor } from "../models/instructor.model";
import bcrypt from "bcryptjs";
import { Resend } from "resend";
import PasswordResetRequestEmail from "../templates/emails/password-reset-request";
import PasswordResetCodeEmail from "../templates/emails/password-reset-code";
import Otp from "../models/otp.model";
import { generateSession } from "./session.service";
import { generateJWT, getClientIp } from "../utils";
import { sendVerificationEmail } from "./email.service";

const instructorLoginValidation = async (payload: { email?: string; password?: string }) => {
    const { email, password } = payload;

    // Validate required fields
    if (!email || !password) {
        return {
            isValid: false,
            message: "Email and password are required"
        };
    }

    const instructor = await Instructor.findOne({ email });

    if (!instructor) {
        return {
            isValid: false,
            message: "Invalid credentials"
        };
    }

    if (!instructor.isVerified) {
        return {
            isValid: false,
            message: "Instructor account is not verified"
        };
    }

    const isPasswordValid = await bcrypt.compare(password, instructor.password);

    if (!isPasswordValid) {
        return {
            isValid: false,
            message: "Invalid credentials"
        };
    }

    return {
        isValid: true,
        message: "Validation passed",
        instructor
    };
};

const applyInstructorValidation = async (payload: { name?: string; email?: string; password?: string; phone?: string; profilePicture?: string }) => {
    const { name, email, password, phone, profilePicture } = payload;

    // Validate required fields
    if (!name || !email || !password || !phone || !profilePicture) {
        return {
            isValid: false,
            message: "All fields are required"
        };
    }

    const existingInstructor = await Instructor.findOne({ email });

    if (existingInstructor) {
        return {
            isValid: false,
            message: "Instructor with this email already exists"
        };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    return {
        isValid: true,
        message: "Validation passed",
        hashedPassword
    };
};

const verifyInstructor = async (instructorId: string) => {
    if (!instructorId) {
        return {
            success: false,
            message: "Instructor ID is required"
        };
    }

    const instructor = await Instructor.findByIdAndUpdate(
        instructorId,
        { isVerified: true },
        { new: true }
    );

    if (!instructor) {
        return {
            success: false,
            message: "Instructor not found"
        };
    }

    return {
        success: true,
        message: "Instructor verified successfully",
        instructor: {
            name: instructor.name,
            email: instructor.email,
            isVerified: instructor.isVerified
        }
    };
};

const sendResetPasswordCode = async (email: string) => {
    if (!email) {
        return {
            success: false,
            message: "Email is required"
        };
    }

    const instructor = await Instructor.findOne({ email });

    if (!instructor) {
        return {
            success: false,
            message: "Instructor not found"
        };
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetTokenExpiry = new Date(Date.now() + 10 * 60 * 1000);

    instructor.resetPasswordToken = resetCode;
    instructor.resetPasswordExpiry = resetTokenExpiry;
    await instructor.save();

    const passwordResetProps = {
        previewText: "Reset your password with your 6-digit code",
        logo_url: "https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/light/notion.png",
        username: instructor.name,
        code: resetCode
    };

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
        from: process.env.RESEND_EMAIL_SENDER || "Acme <onboarding@resend.dev>",
        to: [instructor.email],
        subject: "Password Reset Request",
        react: PasswordResetRequestEmail(passwordResetProps)
    });

    if (error) {
        console.error('Email sending error --->', error);
        return {
            success: false,
            message: "Failed to send reset email"
        };
    }

    return {
        success: true,
        message: "Password reset code sent successfully"
    };
};

const resetPassword = async (code: string, password: string) => {
    if (!code || !password) {
        return {
            success: false,
            message: "Code and password are required"
        };
    }

    const instructor = await Instructor.findOne({ resetPasswordToken: code });

    if (!instructor) {
        return {
            success: false,
            message: "Invalid or expired reset code"
        };
    }

    if (instructor.resetPasswordExpiry && instructor.resetPasswordExpiry < new Date()) {
        return {
            success: false,
            message: "Reset code has expired"
        };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    instructor.password = hashedPassword;
    instructor.resetPasswordToken = undefined;
    instructor.resetPasswordExpiry = undefined;
    await instructor.save();

    return {
        success: true,
        message: "Password reset successfully"
    };
};

const resendResetPassword = async (email: string) => {
    if (!email) {
        return {
            success: false,
            message: "Email is required"
        };
    }

    const instructor = await Instructor.findOne({ email });

    if (!instructor) {
        return {
            success: false,
            message: "Instructor not found"
        };
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetExpiry = new Date(Date.now() + 10 * 60 * 1000);

    instructor.resetPasswordToken = resetCode;
    instructor.resetPasswordExpiry = resetExpiry;
    await instructor.save();

    const passwordResetProps = {
        previewText: "Your password reset code",
        logo_url: "https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/light/notion.png",
        username: instructor.name,
        code: resetCode
    };

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
        from: process.env.RESEND_EMAIL_SENDER || "Acme <onboarding@resend.dev>",
        to: [instructor.email],
        subject: "Password Reset Code",
        react: PasswordResetCodeEmail(passwordResetProps)
    });

    if (error) {
        console.error('Email sending error --->', error);
        return {
            success: false,
            message: "Failed to send reset email"
        };
    }

    return {
        success: true,
        message: "Reset code sent successfully"
    };
};

const rejectInstructor = async (instructorId: string) => {
    if (!instructorId) {
        return {
            success: false,
            message: "Instructor ID is required"
        };
    }

    const instructor = await Instructor.findByIdAndDelete(instructorId);

    if (!instructor) {
        return {
            success: false,
            message: "Instructor not found"
        };
    }

    return {
        success: true,
        message: "Instructor rejected successfully"
    };
};

const getAllInstructors = async () => {
    try {
        const instructors = await Instructor.find();
        return {
            success: true,
            instructors
        };
    } catch (error) {
        return {
            success: false,
            message: "Failed to fetch instructors"
        };
    }
};

const getInstructorById = async (instructorId: string) => {
    if (!instructorId) {
        return {
            success: false,
            message: "Instructor ID is required"
        };
    }

    const instructor = await Instructor.findById(instructorId);

    if (!instructor) {
        return {
            success: false,
            message: "Instructor not found"
        };
    }

    return {
        success: true,
        instructor
    };
};

const deleteInstructor = async (instructorId: string) => {
    if (!instructorId) {
        return {
            success: false,
            message: "Instructor ID is required"
        };
    }

    const instructor = await Instructor.findByIdAndDelete(instructorId);

    if (!instructor) {
        return {
            success: false,
            message: "Instructor not found"
        };
    }

    return {
        success: true,
        message: "Instructor deleted successfully"
    };
};

const updateInstructor = async (instructorId: string, updateData: { name?: string; email?: string; password?: string }) => {
    if (!instructorId) {
        return {
            success: false,
            message: "Instructor ID is required"
        };
    }

    const data: any = {};
    if (updateData.name) data.name = updateData.name;
    if (updateData.email) data.email = updateData.email;
    if (updateData.password) data.password = await bcrypt.hash(updateData.password, 10);

    const instructor = await Instructor.findByIdAndUpdate(instructorId, data, { new: true });

    if (!instructor) {
        return {
            success: false,
            message: "Instructor not found"
        };
    }

    return {
        success: true,
        message: "Instructor updated successfully",
        instructor
    };
};

const verifyInstructorOtp = async (otp: string, req: any) => {
    if (!otp || typeof otp !== 'string') {
        return {
            success: false,
            message: 'OTP is required and must be a string'
        };
    }

    if (otp.length !== 6) {
        return {
            success: false,
            message: 'OTP must be exactly 6 digits'
        };
    }

    const findOtp = await Otp.findOne({ otp });

    if (!findOtp) {
        return {
            success: false,
            message: 'The verification code you entered is invalid or has expired. Please request a new one.'
        };
    }

    await findOtp.deleteOne();

    const findInstructor = await Instructor.findById(findOtp.accountToVerifyId);

    if (!findInstructor) {
        return {
            success: false,
            message: 'Instructor account not found. Please contact support.'
        };
    }

    const ip = getClientIp(req);
    const userAgent = req.get('User-Agent') || '';

    if (findOtp.useCase === 'login') {
        const sessionRes = await generateSession({ ip, userAgent, userId: findInstructor._id.toString() });

        if (!sessionRes.isSuccessful) {
            return {
                success: false,
                message: sessionRes.reason
            };
        }

        const access_code = generateJWT({ sessionId: sessionRes.sessionId, type: 'access', userId: findInstructor._id.toString() });

        return {
            success: true,
            message: 'Login successful',
            instructor: {
                name: findInstructor.name,
                email: findInstructor.email,
                profilePicture: findInstructor.profilePicture,
                phone: findInstructor.phone,
                courses: findInstructor.courses,
                moneyMade: findInstructor.moneyMade,
                youtubeTokens: findInstructor.youtubeTokens,
                isVerified: findInstructor.isVerified
            },
            accessToken: access_code as string
        };
    }

    return {
        success: false,
        message: 'Something unexpected happened. Try again later.'
    };
};

const resendInstructorOtp = async (email: string) => {
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

    const instructor = await Instructor.findOne({ email });

    if (!instructor) {
        return {
            success: false,
            message: 'Instructor not found'
        };
    }

    const emailStatus = await sendVerificationEmail(instructor._id.toString(), instructor.email, 'login');

    if (emailStatus === 'rate-limited') {
        return {
            success: false,
            message: 'Too many attempts. Please wait 15 minutes to request another code.'
        };
    }

    if (emailStatus === 'error') {
        return {
            success: false,
            message: 'Failed to send verification email. Please try again.'
        };
    }

    return {
        success: true,
        message: 'OTP code has been resent to your email.'
    };
};

export { instructorLoginValidation, applyInstructorValidation, verifyInstructor, sendResetPasswordCode, resetPassword, resendResetPassword, rejectInstructor, getAllInstructors, getInstructorById, deleteInstructor, updateInstructor, verifyInstructorOtp, resendInstructorOtp };
