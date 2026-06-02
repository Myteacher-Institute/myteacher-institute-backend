import mongoose from "mongoose";
// Type definitions for the application
// Add your custom types and interfaces here


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
