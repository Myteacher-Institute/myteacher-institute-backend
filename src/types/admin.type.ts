import mongoose from "mongoose";

export interface IAdmin extends mongoose.Document {
    name: string;
    email: string;
    password: string;
    isAdmin: boolean;
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
