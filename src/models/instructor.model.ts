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
    password: { 
        type: String, 
        required: true 
    },
    moneyMade: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },
    resetPasswordToken: { type: String },
    resetPasswordExpiry: { type: Date },
    youtubeTokens: {
        accessToken: { type: String, default: '' },
        refreshToken: { type: String, default: '' },
        expiryDate: { type: Number, default: 0 }
    }
}, {
    timestamps: true
});

export const Instructor = mongoose.model<IInstructor>("Instructor", instructorSchema);
