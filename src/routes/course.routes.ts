import { Router } from "express";
import { isInstructor } from "../middleware/is-instructor";
import { ProtectMiddleWare } from "../middleware/protect-route";
import { handleAddCourse, handleFetchCoursesByAppliedUser, handleFetchAllCourses } from "../controllers/course.controller";

const courseRouter: Router = Router();

// Add course (instructor only)
courseRouter.post("/add", ProtectMiddleWare, isInstructor, handleAddCourse);

// Fetch courses by applied user (protected route)
courseRouter.get("/my-courses", ProtectMiddleWare, handleFetchCoursesByAppliedUser);

// Fetch all courses (public route - excluding courseVideos and certificate)
courseRouter.get("/all", handleFetchAllCourses);

export default courseRouter;
