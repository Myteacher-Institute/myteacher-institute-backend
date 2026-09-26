import { Router } from "express";
import { isInstructor } from "../middleware/is-instructor";
import { ProtectMiddleWare } from "../middleware/protect-route";
import { handleAddCourse, handleCourseEdit, handleFetchCourseById, handleFetchCoursePreview, handleFetchCoursesByAppliedUser, handleFetchAllCourses, handleBrowseCourses, handleFetchCoursesByInstructor, handleDeleteCourse, handleRetryDeletion, handleDeleteOnly, handleAddRating, handleInstructorStatistics, handleInstructorReviews } from "../controllers/course.controller";
import { handleCreateCourseCreation, handleCreateCourseEdit, handleFetchActiveCourseCreations, upload as courseCreationUpload } from "../controllers/course-creation.controller";
import rateLimit from "express-rate-limit";

const courseRouter: Router = Router();

// Rate limiter for course operations
const courseOperationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // Limit each IP to 30 course operations per 15 minutes
    message: {
        error: "Too many course operations, please try again after 15 minutes"
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Add course (instructor only)
courseRouter.post("/add", ProtectMiddleWare, isInstructor, courseOperationLimiter, handleAddCourse);

// Start a background, resumable course creation job (instructor only). Accepts
// one multipart form: metadata JSON + all video/asset files. Must come before
// the GET /:courseId catch-all.
courseRouter.post("/creation", ProtectMiddleWare, isInstructor, courseCreationUpload.any(), handleCreateCourseCreation);

// Fetch the instructor's in-progress course creations (dashboard status card).
courseRouter.get("/creation/active", ProtectMiddleWare, isInstructor, handleFetchActiveCourseCreations);

// Start a background, resumable course edit job (instructor only). Accepts one
// multipart form: metadata JSON + only the NEW video/asset files. Must come
// before the GET /:courseId catch-all.
courseRouter.post("/edit-job/:courseId", ProtectMiddleWare, isInstructor, courseCreationUpload.any(), handleCreateCourseEdit);

// Edit course (instructor only)
courseRouter.put("/edit/:courseId", ProtectMiddleWare, isInstructor, courseOperationLimiter, handleCourseEdit);

// Delete course (instructor only)
courseRouter.delete("/delete/:courseId", ProtectMiddleWare, isInstructor, courseOperationLimiter, handleDeleteCourse);

// Retry deletion (instructor only)
courseRouter.post("/retry-deletion/:courseId", ProtectMiddleWare, isInstructor, courseOperationLimiter, handleRetryDeletion);

// Delete only (instructor only) - for deletion before upload flow
courseRouter.post("/delete-only/:courseId", ProtectMiddleWare, isInstructor, courseOperationLimiter, handleDeleteOnly);

// Fetch courses by applied user (protected route) - must come before /:courseId
courseRouter.get("/my-courses", ProtectMiddleWare, handleFetchCoursesByAppliedUser);

// Fetch courses by instructor (instructor only)
courseRouter.get("/instructor-courses", ProtectMiddleWare, isInstructor, handleFetchCoursesByInstructor);

// Get instructor statistics (instructor only)
courseRouter.get("/instructor-statistics", ProtectMiddleWare, isInstructor, handleInstructorStatistics);

// Get instructor reviews (instructor only)
courseRouter.get("/instructor-reviews", ProtectMiddleWare, isInstructor, handleInstructorReviews);

// Add rating to course (protected route - students only)
courseRouter.post("/:courseId/rating", ProtectMiddleWare, courseOperationLimiter, handleAddRating);

// Fetch all courses (public route - excluding courseVideos and certificate) - must come before /:courseId
courseRouter.get("/all", handleFetchAllCourses);

// Browse courses (public route) - lean projection, preview-video courses only,
// with pagination, search and category filter for the All-Courses page.
courseRouter.get("/browse", handleBrowseCourses);

// Fetch course preview (protected route) - only preview videos + lean fields,
// used by the protected course purchase page. Must come before /:courseId.
courseRouter.get("/:courseId/preview", ProtectMiddleWare, handleFetchCoursePreview);

// Fetch course by ID (protected route) - must come after specific routes
courseRouter.get("/:courseId", ProtectMiddleWare, handleFetchCourseById);

export default courseRouter;
