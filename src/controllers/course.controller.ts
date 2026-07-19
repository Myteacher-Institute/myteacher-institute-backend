import { Request, Response } from "express";
import { Course } from "../models/course.model";
import { Instructor } from "../models/instructor.model";
import { AddCourseReqBody, AddCourseResT, FetchCoursesByUserResT, FetchAllCoursesResT, EditCourseReqBody, EditCourseResT, FetchCourseByIdResT } from "../types";
import { addCourseValidation } from "../services";

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

        const { courseName, description, courseVideos, courseRequirements, price, duration, certificate, programmingCodes, assets, quizzes } = req.body;

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
            programmingCodes: programmingCodes || [],
            assets: assets || [],
            quizzes: quizzes || [],
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

const handleCourseEdit = async (req: Request<{ courseId: string }, {}, EditCourseReqBody>, res: Response<EditCourseResT>) => {
    try {
        const instructorId = req.userId;
        const { courseId } = req.params;

        if (!instructorId) {
            return res.status(401).json({
                status: "failed",
                message: "Unauthorized: Instructor ID not found"
            });
        }

        if (!courseId) {
            return res.status(400).json({
                status: "failed",
                message: "Course ID is required"
            });
        }

        // Find the course
        const course = await Course.findById(courseId);

        if (!course) {
            return res.status(404).json({
                status: "failed",
                message: "Course not found"
            });
        }

        // Verify that the instructor owns this course
        if (course.instructorDetails.userId.toString() !== instructorId) {
            return res.status(403).json({
                status: "failed",
                message: "You are not authorized to edit this course"
            });
        }

        // Update course with provided fields
        const { courseName, description, courseVideos, courseRequirements, price, duration, certificate, programmingCodes, assets, quizzes } = req.body;

        if (courseName !== undefined) course.courseName = courseName;
        if (description !== undefined) course.description = description;
        if (courseVideos !== undefined) course.courseVideos = courseVideos;
        if (courseRequirements !== undefined) course.courseRequirements = courseRequirements;
        if (price !== undefined) course.price = price;
        if (duration !== undefined) course.duration = duration;
        if (certificate !== undefined) course.certificate = certificate;
        if (programmingCodes !== undefined) course.programmingCodes = programmingCodes;
        if (assets !== undefined) course.assets = assets;
        if (quizzes !== undefined) course.quizzes = quizzes;

        const updatedCourse = await course.save();

        return res.status(200).json({
            status: "success",
            message: "Course updated successfully",
            course: updatedCourse
        });

    } catch (error) {
        console.error('Edit course error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

const handleFetchCourseById = async (req: Request<{ courseId: string }>, res: Response<FetchCourseByIdResT>) => {
    try {
        const { courseId } = req.params;

        if (!courseId) {
            return res.status(400).json({
                status: "failed",
                message: "Course ID is required"
            });
        }

        const course = await Course.findById(courseId);

        if (!course) {
            return res.status(404).json({
                status: "failed",
                message: "Course not found"
            });
        }

        return res.status(200).json({
            status: "success",
            message: "Course fetched successfully",
            course
        });

    } catch (error) {
        console.error('Fetch course by ID error --->', (error as Error)?.message ?? error);
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

export { handleAddCourse, handleCourseEdit, handleFetchCourseById, handleFetchCoursesByAppliedUser, handleFetchAllCourses };