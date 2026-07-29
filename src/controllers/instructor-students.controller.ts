import { Request, Response } from "express";
import { fetchInstructorStudents } from "../services/instructor-students.service";
import { FetchInstructorStudentsResT } from "../types";

const handleFetchInstructorStudents = async (req: Request, res: Response<FetchInstructorStudentsResT>) => {
    try {
        const instructorId = req.userId;

        if (!instructorId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized: Instructor ID not found"
            });
        }

        const result = await fetchInstructorStudents(instructorId);

        if (!result.success) {
            return res.status(500).json({
                status: "failed",
                message: result.message || "Failed to fetch students"
            });
        }

        return res.status(200).json({
            status: "success",
            message: "Students fetched successfully",
            courses: result.data
        });

    } catch (error) {
        console.error('Fetch instructor students error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

export { handleFetchInstructorStudents };
