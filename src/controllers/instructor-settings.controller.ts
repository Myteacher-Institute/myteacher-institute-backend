import { Request, Response } from "express";
import { editInstructorProfile, sendDeleteAccountOTP, deleteInstructorAccount } from "../services/instructor-profile.service";
import { reportBug } from "../services/bug-report.service";
import { EditInstructorProfileResT, SendDeleteAccountOTPReqBody, SendDeleteAccountOTPResT, VerifyDeleteAccountOTPReqBody, DeleteInstructorAccountResT, ReportBugResT } from "../types";

const handleEditInstructorProfile = async (req: Request, res: Response<EditInstructorProfileResT>) => {
    try {
        const instructorId = req.userId;

        if (!instructorId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized: Instructor ID not found"
            });
        }

        const result = await editInstructorProfile(instructorId, req.body);

        if (!result.success) {
            return res.status(500).json({
                status: "failed",
                message: result.message || "Failed to update profile"
            });
        }

        return res.status(200).json({
            status: "success",
            message: "Profile updated successfully",
            instructor: result.data
        });

    } catch (error) {
        console.error('Edit instructor profile error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleSendDeleteAccountOTP = async (req: Request, res: Response<SendDeleteAccountOTPResT>) => {
    try {
        const instructorId = req.userId;

        if (!instructorId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized: Instructor ID not found"
            });
        }

        const result = await sendDeleteAccountOTP(instructorId);

        if (!result.success) {
            return res.status(500).json({
                status: "failed",
                message: result.message || "Failed to send OTP"
            });
        }

        return res.status(200).json({
            status: "success",
            message: result.message
        });

    } catch (error) {
        console.error('Send delete account OTP error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleDeleteInstructorAccount = async (req: Request, res: Response<DeleteInstructorAccountResT>) => {
    try {
        const instructorId = req.userId;

        if (!instructorId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized: Instructor ID not found"
            });
        }

        const { otp, reason } = req.body;

        if (!otp) {
            return res.status(400).json({
                status: "failed",
                message: "OTP is required"
            });
        }

        const result = await deleteInstructorAccount(instructorId, otp, reason);

        if (!result.success) {
            return res.status(500).json({
                status: "failed",
                message: result.message || "Failed to delete account"
            });
        }

        return res.status(200).json({
            status: "success",
            message: result.message
        });

    } catch (error) {
        console.error('Delete instructor account error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleReportBug = async (req: Request, res: Response<ReportBugResT>) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized: User ID not found"
            });
        }

        const { title, description, priority, screenshots } = req.body;

        if (!title || !description) {
            return res.status(400).json({
                status: "failed",
                message: "Title and description are required"
            });
        }

        const result = await reportBug(userId, "instructor", { title, description, priority, screenshots });

        if (!result.success) {
            return res.status(500).json({
                status: "failed",
                message: result.message || "Failed to report bug"
            });
        }

        return res.status(200).json({
            status: "success",
            message: "Bug reported successfully",
            bugReport: result.data
        });

    } catch (error) {
        console.error('Report bug error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

export { handleEditInstructorProfile, handleSendDeleteAccountOTP, handleDeleteInstructorAccount, handleReportBug };
