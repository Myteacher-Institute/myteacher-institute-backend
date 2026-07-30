import { Request, Response } from "express";
import { fetchInstructorEarnings } from "../services/instructor-earnings.service";
import { FetchInstructorEarningsResT } from "../types";

const handleFetchInstructorEarnings = async (req: Request, res: Response<FetchInstructorEarningsResT>) => {
    try {
        const instructorId = req.userId;

        if (!instructorId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized: Instructor ID not found"
            });
        }

        const result = await fetchInstructorEarnings(instructorId);

        if (!result.success) {
            return res.status(500).json({
                status: "failed",
                message: result.message || "Failed to fetch earnings"
            });
        }

        return res.status(200).json({
            status: "success",
            message: "Earnings fetched successfully",
            earnings: result.data
        });

    } catch (error) {
        console.error('Fetch instructor earnings error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

export { handleFetchInstructorEarnings };
