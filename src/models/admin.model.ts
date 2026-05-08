import mongoose, { Schema } from "mongoose";
import { IAdmin } from "../types/admin.type";

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
}, {
    timestamps: true
});

export const Admin = mongoose.model<IAdmin>("Admin", adminSchema);
