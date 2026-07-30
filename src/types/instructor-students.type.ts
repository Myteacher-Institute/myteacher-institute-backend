import mongoose from "mongoose";

export interface AppliedUser {
    userId: mongoose.Types.ObjectId;
    userName: string;
    userEmail: string;
    ipAddress: string;
    appliedAt: Date;
}

export interface CourseWithStudents {
    _id: mongoose.Types.ObjectId;
    courseName: string;
    appliedUsers: AppliedUser[];
}

export interface FetchInstructorStudentsResT {
    status: "success" | "failed";
    message: string;
    courses?: CourseWithStudents[];
}
