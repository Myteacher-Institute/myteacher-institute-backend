import mongoose from "mongoose";

export interface IInstructor extends mongoose.Document {
    name: string;
    email: string;
    profilePicture: string;
    phone: string;
    courses: mongoose.Types.ObjectId[];
    password: string;
    moneyMade: number;
    specialization: string;
    isVerified: boolean;
    resetPasswordToken?: string;
    resetPasswordExpiry?: Date;
    youtubeTokens?: {
        accessToken: string;
        refreshToken: string;
        expiryDate: number;
    };
    driveTokens?: {
        accessToken: string;
        refreshToken: string;
        expiryDate: number;
    };
    isOnline?: boolean;
    lastSeen?: Date;
    socketId?: string;
}

export type InstructorLoginReqBody = {
    email: string;
    password: string;
}

export type InstructorLoginResT = {
    status: "success" | "failed",
    message: string,
    instructor?: any,
    accessToken?: string
}

export type ApplyInstructorReqBody = {
    name: string;
    email: string;
    password: string;
    phone: string;
    specialization: string;
    profilePicture: string;
}

export type ApplyInstructorResT = {
    status: "success" | "failed",
    message: string,
    instructor?: any
}

export type GetAllInstructorsResT = {
    status: "success" | "failed",
    message?: string,
    instructors?: IInstructor[]
}

export type RejectInstructorResT = {
    status: "success" | "failed",
    message: string
}

export type SendResetPasswordCodeReqBody = {
    email: string;
}

export type SendResetPasswordCodeResT = {
    status: "success" | "failed",
    message: string
}

export type ResetPasswordReqBody = {
    code: string;
    password: string;
}

export type ResetPasswordResT = {
    status: "success" | "failed",
    message: string
}


export type VerifyInstructorResT = {
    status: "success" | "failed",
    message: string,
    instructor?: {
        name: string;
        email: string;
        isVerified: boolean;
    }
}

export type GetInstructorByIdResT = {
    status: "success" | "failed",
    message?: string,
    instructor?: IInstructor
}

export type DeleteInstructorResT = {
    status: "success" | "failed",
    message: string
}

export type UpdateInstructorReqBody = {
    name?: string;
    email?: string;
    password?: string;
}

export type UpdateInstructorResT = {
    status: "success" | "failed",
    message: string,
    instructor?: IInstructor
}

export type VerifyInstructorOtpReqBody = {
    otp: string;
}

export type VerifyInstructorOtpResT = {
    status: "success" | "failed",
    message: string,
    instructor?: {
        name: string;
        email: string;
        profilePicture: string;
        phone: string;
        specialization: string;
        courses: Array<any>;
        moneyMade: number;
        youtubeTokens: {} | any;
        isVerified: boolean;
    },
    accessToken?: string,
    cookie?: {
        name: string;
        value: string;
    }
}

export type ResendInstructorOtpReqBody = {
    email: string;
}

export type ResendInstructorOtpResT = {
    status: "success" | "failed",
    message: string
}
