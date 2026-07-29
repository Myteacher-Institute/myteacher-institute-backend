import mongoose from "mongoose";

export interface CourseEarnings {
    _id: mongoose.Types.ObjectId;
    courseName: string;
    price: number;
    studentCount: number;
    totalRevenue: number;
    instructorShare: number;
    companyShare: number;
}

export interface EarningsData {
    totalRevenue: number;
    totalInstructorEarnings: number;
    totalCompanyEarnings: number;
    totalStudents: number;
    courses: CourseEarnings[];
    monthlyEarnings: {
        month: string;
        revenue: number;
        instructorEarnings: number;
    }[];
}

export interface FetchInstructorEarningsResT {
    status: "success" | "failed";
    message: string;
    earnings?: EarningsData;
}
