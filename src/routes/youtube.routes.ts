import { Router } from "express";
import { ProtectMiddleWare } from "../middleware/protect-route";
import { handleUploadToYouTube, handleYouTubeAuth, handleYouTubeCallback } from "../controllers/youtube-upload.controller";

const youtubeRoute: Router = Router();

// Get YouTube authentication URL (requires authentication)
youtubeRoute.get("/auth", ProtectMiddleWare, handleYouTubeAuth);

// Handle OAuth callback from Google (no auth required - this is the OAuth callback)
youtubeRoute.get("/callback", handleYouTubeCallback);

// Upload video to YouTube (requires authentication)
youtubeRoute.post("/upload", ProtectMiddleWare, handleUploadToYouTube);

export default youtubeRoute;
