import mongoose from "mongoose";

export interface IUser extends mongoose.Document {
    password: string;
    email: string;
    name: string;
    phone?: string;
    isEmailVerified: boolean;
    hasOnboarded: boolean;
    role: "user" | "instructor" | "admin"
}

export interface IResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}
