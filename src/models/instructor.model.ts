import mongoose, { Schema } from "mongoose";
import { IInstructor } from "../types";

const instructorSchema = new Schema<IInstructor>({
    name: { 
        type: String, 
        required: true 
    },
    email: { 
        type: String, 
        required: true, 
        unique: true 
    },
    profilePicture: { 
        type: String, 
        required: true 
    },
    phone: { 
        type: String, 
        required: true 
    },
    courses: [{ 
        type: Schema.Types.ObjectId, 
        ref: "Course" 
    }],
    specialization: { 
        type: String, 
        required: true 
    },
    password: { 
        type: String, 
        required: true 
    },
    moneyMade: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },
    resetPasswordToken: { type: String },
    resetPasswordExpiry: { type: Date },
    deleteAccountToken: { type: String },
    deleteAccountExpiry: { type: Date },
    youtubeTokens: {
        accessToken: { type: String, default: '' },
        refreshToken: { type: String, default: '' },
        expiryDate: { type: Number, default: 0 }
    },
    driveTokens: {
        accessToken: { type: String, default: '' },
        refreshToken: { type: String, default: '' },
        expiryDate: { type: Number, default: 0 }
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
    affiliate_id: {
        type: String,
        unique: true,
        sparse: true
    },
    hasAffiliateAccount: {
        type: Boolean,
        default: false
    },
    affiliate_money: {
        type: Number,
        default: 0
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true
    },
    recommendations: {
        type: [String],
        default: []
    },
    recommendationsProvided: {
        type: Boolean,
        default: false
    },
    isMentor: {
        type: Boolean,
        default: false
    },
    mentorshipBio: {
        type: String
    },
    whatsappNumber: {
        type: String
    },
    mentorshipPrice: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

export const Instructor = mongoose.model<IInstructor>("Instructor", instructorSchema);
