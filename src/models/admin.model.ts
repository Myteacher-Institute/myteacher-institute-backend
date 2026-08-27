import mongoose, { Schema } from "mongoose";
import { IAdmin } from "../types";

const adminSchema = new Schema<IAdmin>({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    isAdmin: {
        type: Boolean,
        default: true
    },
    resetPasswordToken: {
        type: String
    },
    resetPasswordExpiry: {
        type: Date
    },
    isOnline: {
        type: Boolean,
        default: false
    },
    lastSeen: {
        type: Date
    },
    socketId: {
        type: String
    },
    recommendations: {
        type: [String],
        default: []
    },
    recommendationsProvided: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

export const Admin = mongoose.model<IAdmin>("Admin", adminSchema);
