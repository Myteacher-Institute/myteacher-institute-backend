import mongoose from "mongoose";

// Edit Instructor Profile
export interface EditInstructorProfileReqBody {
    name?: string;
    email?: string;
    phone?: string;
    bio?: string;
    expertise?: string[];
    profilePicture?: string;
}

export interface EditInstructorProfileResT {
    status: "success" | "failed";
    message: string;
    instructor?: any;
}

// Delete Instructor Account
export interface SendDeleteAccountOTPReqBody {
    reason?: string;
}

export interface SendDeleteAccountOTPResT {
    status: "success" | "failed";
    message: string;
}

export interface VerifyDeleteAccountOTPReqBody {
    otp: string;
    reason?: string;
}

export interface DeleteInstructorAccountResT {
    status: "success" | "failed";
    message: string;
}

// Report Bug
export interface ReportBugReqBody {
    title: string;
    description: string;
    priority?: "low" | "medium" | "high" | "critical";
    screenshots?: string[];
}

export interface ReportBugResT {
    status: "success" | "failed";
    message: string;
    bugReport?: any;
}
