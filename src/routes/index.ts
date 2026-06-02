// Route definitions
<<<<<<< HEAD
export { default as authRouter } from './auth.routes';
export { default as adminRouter } from './admin.routes';
export { default as courseRouter } from './course.routes';
export { default as paymentRouter } from './payment.routes';
export { default as youtubeRouter } from './youtube.routes';
export { default as instructorRouter } from './instructor.routes';
=======
// Add API routes here

import { type Router, Router as ExpressRouter, json } from 'express';
import authRoute from './auth.route';

const router: Router = ExpressRouter();
router.use(json())

router.use('/auth', authRoute);

export default router;
>>>>>>> messiah/feat-auth-polish
