import { Request, Response } from "express";
import { 
    rejectInstructor,
    getAllInstructors,
    getInstructorById,
    deleteInstructor,
    updateInstructor
} from "../services";
import { RejectInstructorResT, GetAllInstructorsResT, GetInstructorByIdResT, DeleteInstructorResT, UpdateInstructorResT } from "../types";

const handleRejectInstructor = async (req: Request<{ instructorId: string }>, res: Response<RejectInstructorResT>) => {
    try {
        const { instructorId } = req.params;
        const result = await rejectInstructor(instructorId);

        if (!result.success) {
            return res.status(result.message?.includes("required") ? 400 : 404).json({
                status: "failed",
                message: result.message || "An error occurred"
            });
        }

        return res.status(200).json({
            status: "success",
            message: result.message || "Instructor rejected successfully"
        });

    } catch (error) {
        console.error('Reject instructor error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleGetAllInstructors = async (req: Request, res: Response<GetAllInstructorsResT>) => {
    try {
        const result = await getAllInstructors();
        return res.status(result.success ? 200 : 500).json({
            status: result.success ? "success" : "failed",
            instructors: result.success ? result.instructors : undefined,
            message: result.success ? undefined : result.message
        });
    } catch (error) {
        console.error('Get all instructors error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleGetInstructorById = async (req: Request<{ instructorId: string }>, res: Response<GetInstructorByIdResT>) => {
    try {
        const { instructorId } = req.params;
        const result = await getInstructorById(instructorId);

        if (!result.success) {
            return res.status(result.message?.includes("required") ? 400 : 404).json({
                status: "failed",
                message: result.message || "An error occurred"
            });
        }

        return res.status(200).json({
            status: "success",
            instructor: result.instructor
        });

    } catch (error) {
        console.error('Get instructor by id error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleDeleteInstructor = async (req: Request<{ instructorId: string }>, res: Response<DeleteInstructorResT>) => {
    try {
        const { instructorId } = req.params;
        const result = await deleteInstructor(instructorId);

        if (!result.success) {
            return res.status(result.message?.includes("required") ? 400 : 404).json({
                status: "failed",
                message: result.message || "An error occurred"
            });
        }

        return res.status(200).json({
            status: "success",
            message: result.message || "Instructor deleted successfully"
        });

    } catch (error) {
        console.error('Delete instructor error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleUpdateInstructor = async (req: Request<{ instructorId: string }>, res: Response<UpdateInstructorResT>) => {
    try {
        const { instructorId } = req.params;
        const { name, email, password } = req.body;
        const result = await updateInstructor(instructorId, { name, email, password });

        if (!result.success) {
            return res.status(result.message?.includes("required") ? 400 : 404).json({
                status: "failed",
                message: result.message || "An error occurred"
            });
        }

        return res.status(200).json({
            status: "success",
            message: result.message || "Instructor updated successfully",
            instructor: result.instructor
        });

    } catch (error) {
        console.error('Update instructor error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

export {
    handleRejectInstructor,
    handleGetAllInstructors,
    handleGetInstructorById,
    handleDeleteInstructor,
    handleUpdateInstructor
};