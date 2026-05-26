import { Router } from "express";
import { handleUploadToYouTube, handleYouTubeAuth, handleYouTubeCallback } from "../controllers/youtube-upload.controller";
import { ProtectMiddleWare } from "../middleware/protect-route";

const router: Router = Router();

// Get YouTube authentication URL (requires authentication)
router.get("/auth", ProtectMiddleWare, handleYouTubeAuth);

// Handle OAuth callback from Google (no auth required - this is the OAuth callback)
router.get("/callback", handleYouTubeCallback);

// Upload video to YouTube (requires authentication)
router.post("/upload", ProtectMiddleWare, handleUploadToYouTube);

export default router;
