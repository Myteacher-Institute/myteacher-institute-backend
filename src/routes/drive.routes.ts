import { Router } from "express";
import { ProtectMiddleWare } from "../middleware/protect-route";
import { isInstructor } from "../middleware/is-instructor";
import { handleDriveUpload, handleDriveAuth, handleDriveCallback, upload } from "../controllers/drive.controller";
import rateLimit from "express-rate-limit";

const driveRouter: Router = Router();

// Rate limiter for Drive upload operations
const driveUploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // Limit each IP to 20 Drive uploads per hour
    message: {
        error: "Too many Drive upload attempts, please try again after an hour"
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Check Google Drive authentication status (instructor only)
driveRouter.get("/auth", ProtectMiddleWare, isInstructor, handleDriveAuth);

// Google Drive OAuth callback (instructor only)
driveRouter.get("/callback", ProtectMiddleWare, isInstructor, handleDriveCallback);

// Upload file to Google Drive (instructor only)
driveRouter.post("/upload", ProtectMiddleWare, isInstructor, driveUploadLimiter, upload.single("file"), handleDriveUpload);

export default driveRouter;
