import { Request, Response } from "express";
import { Instructor } from "../models/instructor.model";
import { generateJWTCookie } from "../utils";
import config from "../config/env";
import { 
    InstructorLoginReqBody, 
    InstructorLoginResT, 
    ApplyInstructorReqBody, 
    ApplyInstructorResT, 
    GetAllInstructorsResT, 
    RejectInstructorResT, 
    VerifyInstructorResT, 
    GetInstructorByIdResT, 
    DeleteInstructorResT, 
    UpdateInstructorResT 
} from "../types";
import { instructorLoginValidation, applyInstructorValidation, verifyInstructor, rejectInstructor, getAllInstructors, getInstructorById, deleteInstructor, updateInstructor } from "../services";

const handleInstructorLogin = async (req: Request<InstructorLoginReqBody>, res: Response<InstructorLoginResT>) => {
    try {
        const validation = await instructorLoginValidation(req.body);
        if (!validation.isValid) {
            return res.status(validation.message.includes("verified") ? 403 : 401).json({
                status: "failed",
                message: validation.message
            });
        }

        const instructor = validation.instructor;
        if (!instructor) {
            return res.status(401).json({
                status: "failed",
                message: "Invalid credentials"
            });
        }
        const userId = instructor._id.toString();

        const refreshToken = await generateJWTCookie({
            type: "refresh",
            userId,
        });

        const accessToken = await generateJWTCookie({
            type: "access",
            userId,
        });

        if (refreshToken === "error" || accessToken === "error") {
            return res.status(500).json({
                status: "failed",
                message: "Something unexpected happened, try again"
            });
        }

        const REFRESH_TOKEN_COOKIE_NAME = config["REFRESH_TOKEN_COOKIE_NAME"];

        res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken);

        return res.status(200).json({
            status: "success",
            message: "Login successful",
            instructor: {
                name: instructor.name,
                email: instructor.email,
                profilePicture: instructor.profilePicture,
                isVerified: instructor.isVerified
            },
            accessToken
        });

    } catch (error) {
        console.error('Instructor login error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleApplyAsInstructor = async (req: Request<ApplyInstructorReqBody>, res: Response<ApplyInstructorResT>) => {
    try {
        const validation = await applyInstructorValidation(req.body);
        if (!validation.isValid) {
            return res.status(validation.message.includes("already exists") ? 409 : 400).json({
                status: "failed",
                message: validation.message
            });
        }

        const { name, email, phone, profilePicture } = req.body;
        const hashedPassword = validation.hashedPassword;

        const newInstructor = await Instructor.create({
            name,
            email,
            password: hashedPassword,
            phone,
            profilePicture,
            isVerified: false
        });

        return res.status(201).json({
            status: "success",
            message: "Instructor application submitted successfully",
            instructor: {
                name: newInstructor.name,
                email: newInstructor.email,
                isVerified: newInstructor.isVerified
            }
        });

    } catch (error) {
        console.error('Apply as instructor error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleVerifyInstructor = async (req: Request<{ instructorId: string }>, res: Response<VerifyInstructorResT>) => {
    try {
        const { instructorId } = req.params;
        const result = await verifyInstructor(instructorId);

        if (!result.success) {
            return res.status(result.message?.includes("required") ? 400 : 404).json({
                status: "failed",
                message: result.message || "An error occurred"
            });
        }

        return res.status(200).json({
            status: "success",
            message: result.message || "Instructor verified successfully",
            instructor: result.instructor
        });

    } catch (error) {
        console.error('Verify instructor error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

export { handleInstructorLogin, handleApplyAsInstructor, handleVerifyInstructor };