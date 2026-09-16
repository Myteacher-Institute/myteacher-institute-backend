import mongoose, { Schema, Document } from "mongoose";

export interface IInstructorReport extends Document {
    studentId: mongoose.Types.ObjectId;
    instructorId: mongoose.Types.ObjectId;
    instructorName: string;
    reason: string;
    description: string;
    status: "pending" | "reviewing" | "resolved" | "dismissed";
    adminNotes?: string;
    mentorshipId?: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const instructorReportSchema = new Schema<IInstructorReport>(
    {
        studentId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: "User"
        },
        instructorId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: "Instructor"
        },
        instructorName: {
            type: String,
            required: true,
            trim: true
        },
        reason: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            required: true,
            trim: true
        },
        status: {
            type: String,
            enum: ["pending", "reviewing", "resolved", "dismissed"],
            default: "pending"
        },
        adminNotes: {
            type: String,
            trim: true
        },
        mentorshipId: {
            type: Schema.Types.ObjectId,
            ref: "MentorshipRequest"
        }
    },
    {
        timestamps: true
    }
);

const InstructorReport = mongoose.model<IInstructorReport>("InstructorReport", instructorReportSchema);

export default InstructorReport;