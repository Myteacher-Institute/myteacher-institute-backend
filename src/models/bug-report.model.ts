import mongoose, { Schema, Document } from "mongoose";

export interface IBugReport extends Document {
    userId: mongoose.Types.ObjectId;
    userType: "user" | "instructor" | "admin";
    title: string;
    description: string;
    priority: "low" | "medium" | "high" | "critical";
    status: "pending" | "in-progress" | "resolved" | "closed";
    screenshots?: string[];
    createdAt: Date;
    updatedAt: Date;
}

const bugReportSchema = new Schema<IBugReport>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            required: true,
            refPath: "userType"
        },
        userType: {
            type: String,
            enum: ["user", "instructor", "admin"],
            required: true
        },
        title: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            required: true,
            trim: true
        },
        priority: {
            type: String,
            enum: ["low", "medium", "high", "critical"],
            default: "medium"
        },
        status: {
            type: String,
            enum: ["pending", "in-progress", "resolved", "closed"],
            default: "pending"
        },
        screenshots: [{
            type: String
        }]
    },
    {
        timestamps: true
    }
);

const BugReport = mongoose.model<IBugReport>("BugReport", bugReportSchema);

export default BugReport;
