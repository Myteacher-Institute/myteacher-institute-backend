import { Router } from "express";
import { ProtectMiddleWare } from "../middleware/protect-route";
import { isInstructor } from "../middleware/is-instructor";
import { handleDriveUpload, handleDriveAuth, handleDriveCallback, upload } from "../controllers/drive.controller";

const driveRouter: Router = Router();

// Check Google Drive authentication status (instructor only)
driveRouter.get("/auth", ProtectMiddleWare, isInstructor, handleDriveAuth);

// Google Drive OAuth callback (instructor only)
driveRouter.get("/callback", ProtectMiddleWare, isInstructor, handleDriveCallback);

// Upload file to Google Drive (instructor only)
driveRouter.post("/upload", ProtectMiddleWare, isInstructor, upload.single("file"), handleDriveUpload);

export default driveRouter;
