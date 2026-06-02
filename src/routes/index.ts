// Route definitions
// Add API routes here

import { type Router, Router as ExpressRouter, json } from 'express';
import authRoute from './auth.route';

const router: Router = ExpressRouter();
router.use(json())

router.use('/auth', authRoute);

export default router;
