import { Router } from 'express';
import {
    handleReportInstructor,
    handleGetAllInstructorReports,
    handleUpdateReportStatus,
    handleGetStudentReports,
    handleGetInstructorReports,
} from '../controllers/instructor-report.controller';
import { ProtectMiddleWare } from '../middleware/protect-route';
import rateLimit from 'express-rate-limit';

const router: Router = Router();

// Rate limiter for report submissions (prevents spam)
const reportLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    message: { error: 'Too many reports submitted. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Student: Report an instructor
router.post('/instructor', ProtectMiddleWare, reportLimiter, handleReportInstructor);

// Student: Get their own reports
router.get('/instructor/my-reports', ProtectMiddleWare, handleGetStudentReports);

// Instructor: Get reports against them
router.get('/instructor/instructor-reports', ProtectMiddleWare, handleGetInstructorReports);

// Admin: Get all reports (with optional status filter)
router.get('/instructor', ProtectMiddleWare, handleGetAllInstructorReports);

// Admin: Update report status
router.patch('/instructor/:reportId', ProtectMiddleWare, handleUpdateReportStatus);

export default router;