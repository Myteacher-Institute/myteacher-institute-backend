import { Router } from "express";
import { isInstructor } from "../middleware/is-instructor";
import { ProtectMiddleWare } from "../middleware/protect-route";
import { handleAddCourse, handleCourseEdit, handleFetchCourseById, handleFetchCoursesByAppliedUser, handleFetchAllCourses } from "../controllers/course.controller";

const courseRouter: Router = Router();

// Add course (instructor only)
courseRouter.post("/add", ProtectMiddleWare, isInstructor, handleAddCourse);

// Edit course (instructor only)
courseRouter.put("/edit/:courseId", ProtectMiddleWare, isInstructor, handleCourseEdit);

// Fetch courses by applied user (protected route) - must come before /:courseId
courseRouter.get("/my-courses", ProtectMiddleWare, handleFetchCoursesByAppliedUser);

// Fetch all courses (public route - excluding courseVideos and certificate) - must come before /:courseId
courseRouter.get("/all", handleFetchAllCourses);

// Fetch course by ID (protected route) - must come after specific routes
courseRouter.get("/:courseId", ProtectMiddleWare, handleFetchCourseById);

export default courseRouter;
