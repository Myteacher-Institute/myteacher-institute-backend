import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { ProtectMiddleWare } from "../middleware/protect-route";
import { handleUploadToYouTube, handleYouTubeAuth, handleYouTubeCallback } from "../controllers/youtube-upload.controller";
import rateLimit from "express-rate-limit";

const youtubeRoute: Router = Router();

// Rate limiter for YouTube upload operations
const youtubeUploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit each IP to 10 YouTube uploads per hour
    message: {
        error: "Too many YouTube upload attempts, please try again after an hour"
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Ensure upload directory exists
const UPLOAD_DIR = process.env.VIDEO_UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'videos');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}${path.extname(file.originalname)}`);
    },
});

const videoFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowed = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Only video files are allowed'));
    }
};

const upload = multer({
    storage,
    fileFilter: videoFilter,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max
});

// Get YouTube authentication URL (requires authentication)
youtubeRoute.get("/auth", ProtectMiddleWare, handleYouTubeAuth);

// Handle OAuth callback from Google (no auth required - this is the OAuth callback)
youtubeRoute.get("/callback", handleYouTubeCallback);

// Upload video to YouTube (requires authentication)
// multer parses the multipart/form-data and puts the file in req.file
youtubeRoute.post("/upload", ProtectMiddleWare, youtubeUploadLimiter, upload.single('video'), handleUploadToYouTube);

export default youtubeRoute;
