// Route definitions
import authRoutes from './auth.routes';
import adminRoutes from './admin.routes';
import courseRoutes from './course.routes';
import instructorRoutes from './instructor.routes';
import { type Router, Router as ExpressRouter } from 'express';

const router: Router = ExpressRouter();

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/course', courseRoutes);
router.use('/instructor', instructorRoutes);

export default router;
