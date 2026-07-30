import { Request, Response, NextFunction } from "express";
import { Instructor } from "../models/instructor.model";

type IsInstructorErrorT = {
    type: "not-instructor" | "server-error",
    message: string
}

const isInstructor = async (req: Request, res: Response<IsInstructorErrorT>, next: NextFunction) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({
                message: 'Unauthorized',
                type: "not-instructor"
            });
        }

        const instructor = await Instructor.findById(userId);

        if (!instructor) {
            return res.status(403).json({
                message: 'Access denied. Instructor only.',
                type: "not-instructor"
            });
        }

        return next();
    } catch (error) {
        console.error('IsInstructor error --->', (error as Error)?.message ?? error);
        res.status(500).json({ message: 'INTERNAL_SERVER_ERROR', type: "server-error" });
    }
};

export { isInstructor };
