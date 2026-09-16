import { Router } from 'express';
import { getStudentStats, getStudentProfile, updateRecommendations, getRecommendedCourses, getMyMentorships, getStudentCertificates } from '../controllers/student.controller';
import { ProtectMiddleWare } from "../middleware/protect-route";
import rateLimit from 'express-rate-limit';

const router: Router = Router();

// Rate limiter for recommendation updates (prevents spam-clicking)
const recommendationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,   // 15 minutes
    max: 10,
    message: { error: "Too many update requests, please try again later" },
    standardHeaders: true,
    legacyHeaders: false,
});

// All student routes require authentication
router.use(ProtectMiddleWare);

router.get('/stats', getStudentStats);
router.get('/profile', getStudentProfile);
router.put('/recommendations', recommendationLimiter, updateRecommendations);
router.get('/recommended-courses', getRecommendedCourses);
router.get('/mentorship', getMyMentorships);
router.get('/certificates', getStudentCertificates);

export default router;
