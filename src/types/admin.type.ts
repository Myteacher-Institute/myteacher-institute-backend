import mongoose from "mongoose";

export interface IAdmin extends mongoose.Document {
    name: string;
    email: string;
    password: string;
    isAdmin: boolean;
    resetPasswordToken?: string;
    resetPasswordExpiry?: Date;
    isOnline?: boolean;
    lastSeen?: Date;
    socketId?: string;
}

export type AddAdminReqBody = {
    name: string;
    email: string;
    password: string;
}

export type AddAdminResT = {
    status: "success" | "failed",
    message: string,
    admin?: {
        name: string;
        email: string;
        isAdmin: boolean;
    }
}

export type AdminLoginReqBody = {
    email: string;
    password: string;
}

export type AdminLoginResT = {
    status: "success" | "failed",
    message: string,
    authUser?: {
        name: string;
        email: string;
        isAdmin: boolean;
    },
    accessToken?: string
}

export type VerifyAdminOtpReqBody = {
    otp: string;
}

export type VerifyAdminOtpResT = {
    status: "success" | "failed",
    message: string,
    authUser?: {
        name: string;
        email: string;
        isAdmin: boolean;
    },
    accessToken?: string
}

export type ResendAdminOtpReqBody = {
    email: string;
}

export type ResendAdminOtpResT = {
    status: "success" | "failed",
    message: string
}

export type SendAdminResetCodeReqBody = {
    email: string;
}

export type SendAdminResetCodeResT = {
    status: "success" | "failed",
    message: string
}

export type ResetAdminPasswordReqBody = {
    code: string;
    password: string;
}

export type ResetAdminPasswordResT = {
    status: "success" | "failed",
    message: string
}
