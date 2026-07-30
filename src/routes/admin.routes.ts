import { Router } from "express";
import { handleAddAdmin, handleAdminLogin, handleVerifyAdminOtp, handleResendAdminOtp, handleSendAdminResetCode, handleResetAdminPassword } from "../controllers/admin.controller";
import {ProtectMiddleWare} from "../middleware/protect-route";
import { isAdmin } from "../middleware/is-admin";

import rateLimit from "express-rate-limit";

const router: Router = Router();

// Create different rate limiters for different endpoints
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        error: "Too many requests from this IP, please try again after 15 minutes"
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 authentication attempts per 15 minutes
    message: {
        error: "Too many authentication attempts, please try again after 15 minutes"
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const otpLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 5, // Limit each IP to 5 OTP requests per 5 minutes
    message: {
        error: "Too many OTP requests, please wait before trying again"
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Limit each IP to 3 password reset attempts per hour
    message: {
        error: "Too many password reset attempts, please try again after an hour"
    },
    standardHeaders: true,
    legacyHeaders: false,
});

router.post("/login", authLimiter, handleAdminLogin);
router.post("/add", ProtectMiddleWare, isAdmin, generalLimiter, handleAddAdmin);
router.post('/verify-otp', otpLimiter, handleVerifyAdminOtp);
router.post('/resend-otp', otpLimiter, handleResendAdminOtp);
router.post('/send-reset-code', passwordResetLimiter, handleSendAdminResetCode);
router.post('/reset-password', passwordResetLimiter, handleResetAdminPassword);

export default router;
