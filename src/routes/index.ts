// Route definitions
// Add API routes here

import { type Router, Router as ExpressRouter } from 'express';
import instructorRoutes from './instructor.routes';
import adminRoutes from './admin.routes';
import authRoutes from './auth.routes';
import courseRoutes from './course.routes';

const router: Router = ExpressRouter();

router.use('/auth', authRoutes);
router.use('/instructor', instructorRoutes);
router.use('/admin', adminRoutes);
router.use('/course', courseRoutes);

export default router;
