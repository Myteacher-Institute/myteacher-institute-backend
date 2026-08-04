import { Router } from "express";

import {
        handleInstructorLogin,
        handleApplyAsInstructor,
        handleVerifyInstructor,
        handleVerifyInstructorOtp,
        handleResendInstructorOtp
} from "../controllers/instructor.controller";

import {
        handleSendResetPasswordCode,
        handleResetPassword,
        handleResendResetPassword
} from "../controllers/instructor-password.controller";

import {
    handleRejectInstructor,
    handleGetAllInstructors,
    handleGetInstructorById,
    handleDeleteInstructor,
    handleUpdateInstructor
} from "../controllers/instructor-setup.controller";

import {
    handleFetchInstructorStudents
} from "../controllers/instructor-students.controller";

import {
    handleFetchInstructorEarnings
} from "../controllers/instructor-earnings.controller";

import {
    handleEditInstructorProfile,
    handleSendDeleteAccountOTP,
    handleDeleteInstructorAccount,
    handleReportBug
} from "../controllers/instructor-settings.controller";

import {
    handleUploadInstructorProfilePicture
} from "../controllers/profile-picture.controller";

import { profileUpload } from "../config/profile-upload";

import { ProtectMiddleWare } from "../middleware/protect-route";
import { isAdmin } from "../middleware/is-admin";
import rateLimit from "express-rate-limit";

const router: Router = Router();

// Create different rate limiters for different endpoints
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

// General limiter for application/submission endpoints
const applicationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Limit each IP to 5 applications per hour
    message: {
        error: "Too many application attempts, please try again after an hour"
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Stricter limiter for admin operations (optional)
const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Limit each IP to 50 admin operations per 15 minutes
    message: {
        error: "Too many admin operations, please slow down"
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Public routes with rate limiting
router.post("/login", authLimiter, handleInstructorLogin);
router.post("/apply", applicationLimiter, handleApplyAsInstructor);
router.post("/verify-otp", otpLimiter, handleVerifyInstructorOtp);
router.post("/resend-otp", otpLimiter, handleResendInstructorOtp);
router.post("/send-reset-code", passwordResetLimiter, handleSendResetPasswordCode);
router.post("/resend-reset-code", passwordResetLimiter, handleResendResetPassword);
router.post("/reset-password", passwordResetLimiter, handleResetPassword);

// Protected instructor routes (must come before /:instructorId)
router.get("/students", ProtectMiddleWare, handleFetchInstructorStudents);
router.get("/earnings", ProtectMiddleWare, handleFetchInstructorEarnings);
router.patch("/profile", ProtectMiddleWare, handleEditInstructorProfile);
router.post("/profile-picture", ProtectMiddleWare, profileUpload.single("profilePicture"), handleUploadInstructorProfilePicture);
router.post("/account/send-delete-otp", ProtectMiddleWare, handleSendDeleteAccountOTP);
router.delete("/account", ProtectMiddleWare, handleDeleteInstructorAccount);
router.post("/report-bug", ProtectMiddleWare, handleReportBug);

// Protected admin routes with optional rate limiting
router.patch("/verify/:instructorId", ProtectMiddleWare, isAdmin, adminLimiter, handleVerifyInstructor);
router.delete("/reject/:instructorId", ProtectMiddleWare, isAdmin, adminLimiter, handleRejectInstructor);
router.get("/all", ProtectMiddleWare, isAdmin, adminLimiter, handleGetAllInstructors);
router.get("/:instructorId", ProtectMiddleWare, isAdmin, adminLimiter, handleGetInstructorById);
router.delete("/:instructorId", ProtectMiddleWare, isAdmin, adminLimiter, handleDeleteInstructor);
router.put("/:instructorId", ProtectMiddleWare, isAdmin, adminLimiter, handleUpdateInstructor);

export default router;