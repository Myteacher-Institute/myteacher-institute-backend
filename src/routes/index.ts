// Route definitions
// Add API routes here

import { type Router, Router as ExpressRouter } from 'express';
import authRoute from './auth.routes';

const router: Router = ExpressRouter();

router.use('/auth', authRoute);

export default router;
