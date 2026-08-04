// Business logic and service layer
// Add database operations, external API calls, etc. here

import { IUser } from "../models/user.model";

import { instructorLoginValidation, applyInstructorValidation, verifyInstructor, sendResetPasswordCode, resetPassword, resendResetPassword, rejectInstructor, getAllInstructors, getInstructorById, deleteInstructor, updateInstructor, verifyInstructorOtp, resendInstructorOtp } from "./instructor.services";
import { adminLoginValidation, verifyAdminOtp, resendAdminOtp, sendAdminResetCode, resetAdminPassword } from "./admin.services";

import { createPaymentLink, verifyTransaction, verifyTransactionByReference, generateTransactionReference } from './flutterwave.services';

import { addCourseValidation } from './course.services';

type signupReqBody = {
    password?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
}

type signupErrorReqBody = {
    isOnkey: boolean;
    errorOnkey: "password" | "email" | "firstName" | "lastName" | "username";
    message: string;
    isSuccess: false;
}

type signupSuccessReqBody = {
    authUser: IUser,
    isSuccess: true,
    message: string,
    showOtpInput: boolean;
}

type signupResponse = signupErrorReqBody | signupSuccessReqBody;

export const validateSignupPayload = (payload: signupReqBody): signupErrorReqBody | null => {
    const { password, email, firstName, lastName } = payload;

    // Validation checks
    if (!password) {
        return {
            isOnkey: true,
            errorOnkey: "password",
            message: "Password is required",
            isSuccess: false
        };
    }

    if (password.length < 6) {
        return {
            isOnkey: true,
            errorOnkey: "password",
            message: "Password must be at least 6 characters",
            isSuccess: false
        };
    }

    if (!email) {
        return {
            isOnkey: true,
            errorOnkey: "email",
            message: "Email is required",
            isSuccess: false
        };
    }

    if (!firstName) {
        return {
            isOnkey: true,
            errorOnkey: "firstName",
            message: "First name is required",
            isSuccess: false
        };
    }

    if (!lastName) {
        return {
            isOnkey: true,
            errorOnkey: "lastName",
            message: "Last name is required",
            isSuccess: false
        };
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return {
            isOnkey: true,
            errorOnkey: "email",
            message: "Invalid email format",
            isSuccess: false
        };
    }

    return null;
};

export {
    instructorLoginValidation,
    applyInstructorValidation,
    verifyInstructor,
    sendResetPasswordCode,
    resetPassword,
    resendResetPassword,
    rejectInstructor,
    getAllInstructors,
    getInstructorById,
    deleteInstructor,
    updateInstructor,
    verifyInstructorOtp,
    resendInstructorOtp,
    createPaymentLink,
    verifyTransaction,
    verifyTransactionByReference,
    generateTransactionReference,
    addCourseValidation,
    adminLoginValidation,
    verifyAdminOtp,
    resendAdminOtp,
    sendAdminResetCode,
    resetAdminPassword
};

export type { signupReqBody, signupErrorReqBody, signupSuccessReqBody, signupResponse };


export * from './otp.service';
export * from './auth.service';
export * from './oauth.service';
export * from './token.service';
export * from './email.service';
export * from './session.service';
export * from './password.service';
export * from './onboarding.service';
export * from './admin.services';
export * from './notification.service';
export * from './user-status.service';
export { ensureOnlineStatusFields } from './user-status.service';
