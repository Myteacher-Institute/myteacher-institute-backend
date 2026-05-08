import { Router } from "express";
import { handleAddCourse, handleFetchCoursesByAppliedUser, handleFetchAllCourses } from "../controllers/course.controller";
import { ProtectMiddleWare } from "../middleware/protect-route";
import { isInstructor } from "../middleware/is-instructor";

const router: Router = Router();

// Add course (instructor only)
router.post("/add", ProtectMiddleWare, isInstructor, handleAddCourse);

// Fetch courses by applied user (protected route)
router.get("/my-courses", ProtectMiddleWare, handleFetchCoursesByAppliedUser);

// Fetch all courses (public route - excluding courseVideos and certificate)
router.get("/all", handleFetchAllCourses);

export default router;
