// Business logic and service layer
// Add database operations, external API calls, etc. here

import { IUser } from "../models/user.model";

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



export type { signupReqBody, signupErrorReqBody, signupSuccessReqBody, signupResponse };
