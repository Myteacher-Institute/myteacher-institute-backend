import { Request, Response } from "express";
import { Course } from "../models/course.model";
import { Instructor } from "../models/instructor.model";
import { AddCourseReqBody, AddCourseResT, FetchCoursesByUserResT, FetchAllCoursesResT } from "../types/course.type";
import { addCourseValidation } from "../services/course.services";

const handleAddCourse = async (req: Request<{}, {}, AddCourseReqBody>, res: Response<AddCourseResT>) => {
    try {
        const instructorId = req.userId;

        // Validate request body and instructor ID
        const validation = addCourseValidation(req.body, instructorId);
        if (!validation.isValid) {
            return res.status(instructorId ? 400 : 401).json({
                status: "failed",
                message: validation.message
            });
        }

        const { courseName, description, courseVideos, courseRequirements, price, duration, certificate } = req.body;

        // Get instructor details from the database
        const instructor = await Instructor.findById(instructorId);

        if (!instructor) {
            return res.status(404).json({
                status: "failed",
                message: "Instructor not found"
            });
        }

        // Create new course
        const newCourse = await Course.create({
            courseName,
            description,
            courseVideos: courseVideos || [],
            courseRequirements: courseRequirements || [],
            appliedUsers: [],
            price,
            duration,
            certificate,
            instructorDetails: {
                userId: instructor._id,
                name: instructor.name,
                email: instructor.email,
                profilePicture: instructor.profilePicture
            }
        });

        return res.status(201).json({
            status: "success",
            message: "Course created successfully",
            course: newCourse
        });

    } catch (error) {
        console.error('Add course error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleFetchCoursesByAppliedUser = async (req: Request, res: Response<FetchCoursesByUserResT>) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized: User ID not found"
            });
        }

        // Fetch courses where the user is in appliedUsers
        const courses = await Course.find({
            "appliedUsers.userId": userId
        });

        return res.status(200).json({
            status: "success",
            message: "Courses fetched successfully",
            courses
        });

    } catch (error) {
        console.error('Fetch courses by applied user error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleFetchAllCourses = async (req: Request, res: Response<FetchAllCoursesResT>) => {
    try {
        // Fetch all courses excluding courseVideos and certificate
        const courses = await Course.find({}, {
            courseVideos: 0,
            certificate: 0
        });

        return res.status(200).json({
            status: "success",
            message: "All courses fetched successfully",
            courses
        });

    } catch (error) {
        console.error('Fetch all courses error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

export { handleAddCourse, handleFetchCoursesByAppliedUser, handleFetchAllCourses };