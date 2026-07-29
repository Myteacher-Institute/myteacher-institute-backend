import { Router } from 'express';
import {ProtectMiddleWare} from "../middleware/protect-route";
import { handleEditUserProfile, handleGetUserProfile } from '../controllers/user.controller';

import rateLimit from "express-rate-limit";

const userRouter: Router = Router();

userRouter.use(ProtectMiddleWare);

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        error: "Too many requests from this IP, please try again after 15 minutes"
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

userRouter.get('/profile', generalLimiter, handleGetUserProfile);
userRouter.patch('/profile', generalLimiter, handleEditUserProfile);

export default userRouter;
